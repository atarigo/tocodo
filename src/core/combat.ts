import type { Attributes, EffectSpec, Skill, Unit } from './types.js';
import { buildAttackTable, resolveDamage, rollOutcome, type AttackOutcome } from './attackTable.js';
import { attackInterval, balanceRoll, effectiveBalance, maxHp, maxMp } from './formulas.js';
import {
  absorbBreakDamage,
  applyEffect,
  incapacitatedBy,
  isSilenced,
  modifiedValue,
  purgeExpired,
  type ActiveEffect,
} from './effects.js';
import { EFFECT_BY_NAME } from './effectRegistry.js';
import type { Rng } from './rng.js';

/** 戰鬥時間上限（秒）：拖過視為玩家落敗 */
const MAX_TIME = 90;
/** 攻速／詠唱速度被壓到接近 0 時的下限（暫定），避免除以零 */
const MIN_SPEED_RATE = 0.05;

export type Side = 'player' | 'enemy';

export type EventKind =
  | 'cast'
  | 'miss'
  | 'hurt'
  | 'dot'
  | 'heal'
  | 'status'
  | 'death'
  | 'system';

export type HurtFlavor = '暴擊' | '碾壓' | '招架' | '格檔' | '未破防' | '真傷';

/** 帶時間戳的結構化戰鬥事件：網頁照時間軸回放，text 供戰報 */
export interface BattleEvent {
  t: number;
  kind: EventKind;
  /** 受身方（hurt/dot ＝ 受傷者、heal ＝ 回復者、cast ＝ 詠唱者…） */
  side: Side | 'none';
  text: string;
  hpAfter?: number;
  flavor?: HurtFlavor;
  /** cast 事件：詠唱長度（秒），供畫面顯示魔法陣 */
  duration?: number;
}

export interface BattleResult {
  winner: Side;
  durationSeconds: number;
  playerHpLeft: number;
  playerMpLeft: number;
  events: BattleEvent[];
  log: string[];
}

interface FighterState {
  side: Side;
  unit: Unit;
  maxHp: number;
  maxMp: number;
  hp: number;
  mp: number;
  nextActionAt: number;
  casting: { skill: Skill; finishAt: number } | null;
  cooldowns: Map<string, number>;
  effects: ActiveEffect[];
}

interface Battle {
  rng: Rng;
  events: BattleEvent[];
  push: (event: BattleEvent) => void;
}

function fmt(value: number): string {
  return value.toFixed(1);
}

/** 出手間隔：武器基礎 ÷ 敏捷加速（武器宣告）÷ 攻速效果倍率 */
function currentInterval(f: FighterState): number {
  const weapon = f.unit.weapon;
  if (!weapon) return 0.5;
  const base = attackInterval(weapon.interval, f.unit.attrs.agi, weapon.agiApplies);
  const rate = Math.max(MIN_SPEED_RATE, modifiedValue(1, f.effects, '攻速'));
  return base / rate;
}

function castDuration(f: FighterState, skill: Skill): number {
  const weaponMult = f.unit.weapon?.castTimeMult ?? 1;
  const rate = Math.max(MIN_SPEED_RATE, modifiedValue(1, f.effects, '詠唱速度'));
  return (skill.castTime * weaponMult) / rate;
}

function mpCost(f: FighterState, skill: Skill): number {
  return skill.mpCost * (f.unit.weapon?.mpCostMult ?? 1);
}

function healSelf(
  battle: Battle,
  f: FighterState,
  heal: { base: number; scaling?: Partial<Attributes> },
  label: string,
  t: number,
): void {
  let amount = heal.base;
  for (const [key, coef] of Object.entries(heal.scaling ?? {})) {
    amount += f.unit.attrs[key as keyof Attributes] * (coef ?? 0);
  }
  const healed = Math.round(amount);
  f.hp = Math.min(f.maxHp, f.hp + healed);
  battle.push({ t, kind: 'heal', side: f.side, text: `【${label}】${f.unit.name} ＋${healed}（${f.hp}）`, hpAfter: f.hp });
}

function applyOneEffect(
  battle: Battle,
  target: FighterState,
  spec: EffectSpec,
  t: number,
): void {
  const result = applyEffect(
    target.effects,
    spec,
    t,
    { wil: target.unit.attrs.wil, vit: target.unit.attrs.vit, maxHp: target.maxHp },
    battle.rng,
  );
  const name = target.unit.name;
  switch (result.outcome) {
    case 'resisted':
      battle.push({ t, kind: 'status', side: target.side, text: `${name} 抵抗了【${spec.name}】` });
      return;
    case 'blocked':
      battle.push({ t, kind: 'status', side: target.side, text: `【${spec.name}】無法覆蓋 ${name} 的既有效果` });
      return;
    default:
      battle.push({
        t,
        kind: 'status',
        side: target.side,
        text: `${name} 中【${spec.name}】${fmt(result.duration)}s`,
        duration: result.duration,
      });
  }
  // 冰凍／暈眩：附加時中斷詠唱（不扣資源——出手才結算）
  if ((spec.name === '冰凍' || spec.name === '暈眩') && target.casting) {
    target.casting = null;
    target.nextActionAt = t + 0.1;
    battle.push({ t, kind: 'status', side: target.side, text: `${name} 詠唱中斷` });
  }
}

/** 結算一次攻擊或治療（skill ＝ undefined 時是普攻） */
function resolveOffense(
  battle: Battle,
  attacker: FighterState,
  defender: FighterState,
  skill: Skill | undefined,
  t: number,
): void {
  const { rng } = battle;
  const weapon = attacker.unit.weapon;
  const label = skill ? skill.name : weapon?.name ?? '攻擊';

  // 純治療技：自身效果，不走攻擊表
  if (skill && !skill.damage && skill.heal) {
    healSelf(battle, attacker, skill.heal, skill.name, t);
    return;
  }

  const dmgSpec = skill?.damage ?? { weaponMult: 1, canCrit: weapon?.kind !== '槍' };
  const incapacitated = incapacitatedBy(defender.effects, t) !== null;

  const table = buildAttackTable({
    attacker: attacker.unit.attrs,
    defender: defender.unit.attrs,
    defenderParryRate: defender.unit.parryRate,
    defenderBlockRate: defender.unit.blockRate,
    attackerCanCrit: dmgSpec.canCrit ?? false,
    attackerCrushRate: skill ? 0 : attacker.unit.crushRate,
    canBeParried: skill ? skill.canBeParried : true,
    canBeBlocked: skill ? skill.canBeBlocked : true,
    defenderIncapacitated: incapacitated,
  });
  const outcome: AttackOutcome = rollOutcome(table, rng);

  if (outcome === '閃避') {
    battle.push({ t, kind: 'miss', side: defender.side, text: `${defender.unit.name} 閃避【${label}】` });
    return;
  }
  if (outcome === '躲避') {
    battle.push({ t, kind: 'miss', side: defender.side, text: `${defender.unit.name} 走運躲過【${label}】` });
    return;
  }

  // 第二階段：傷害
  let damage: number;
  let brokeDefense: boolean;
  let flavor: HurtFlavor | undefined;

  if (dmgSpec.trueDamage !== undefined) {
    damage = dmgSpec.trueDamage;
    brokeDefense = true;
    flavor = '真傷';
  } else {
    let base = dmgSpec.base ?? 0;
    if (dmgSpec.weaponMult && weapon) {
      const balance = effectiveBalance(weapon.balance, weapon.dexAmp ? attacker.unit.attrs.dex : 0);
      let part = balanceRoll(rng, weapon.damage[0], weapon.damage[1], balance);
      if (weapon.strApplies) part += attacker.unit.attrs.str;
      base += part * dmgSpec.weaponMult;
    }
    for (const [key, coef] of Object.entries(dmgSpec.scaling ?? {})) {
      base += attacker.unit.attrs[key as keyof Attributes] * (coef ?? 0);
    }
    if (base <= 0) {
      battle.push({ t, kind: 'miss', side: defender.side, text: `【${label}】軟弱無力，毫無作用` });
      return;
    }
    const armor = modifiedValue(defender.unit.armor, defender.effects, '護甲值總和');
    const reduction = Math.min(1, modifiedValue(defender.unit.reductionRate, defender.effects, '減傷率'));
    const result = resolveDamage(
      outcome,
      base,
      { armor, reductionRate: reduction },
      attacker.unit.damageBonus,
      dmgSpec.pierce ?? false,
    );
    damage = result.damage;
    brokeDefense = result.brokeDefense;
    if (!brokeDefense) flavor = '未破防';
    else if (outcome === '暴擊' || outcome === '碾壓' || outcome === '招架' || outcome === '格檔') {
      flavor = outcome;
    }
  }

  defender.hp -= damage;
  const hpAfter = Math.max(0, defender.hp);
  const flavorText = flavor ? ` ${flavor}` : '';
  battle.push({
    t,
    kind: 'hurt',
    side: defender.side,
    text: `【${label}】${attacker.unit.name} → ${defender.unit.name} −${damage}${flavorText}（${hpAfter}）`,
    hpAfter,
    flavor,
  });

  // 冰凍／暈眩的破除池
  const broken = absorbBreakDamage(defender.effects, damage);
  if (broken) {
    battle.push({ t, kind: 'status', side: defender.side, text: `${defender.unit.name} 的【${broken}】被打破` });
  }

  if (defender.hp <= 0) {
    battle.push({ t, kind: 'death', side: defender.side, text: `${defender.unit.name} 倒下`, hpAfter: 0 });
    return;
  }

  // 特效：未破防不發動（例外由技能宣告）；格檔擋住單體鎖定效果
  if ((brokeDefense || skill?.effectsIgnoreBreak) && outcome !== '格檔') {
    for (const spec of skill?.applies ?? []) {
      applyOneEffect(battle, defender, spec, t);
    }
  }

  // 命中才有的附帶治療（吸血斬）
  if (skill?.heal && skill.damage) {
    healSelf(battle, attacker, skill.heal, skill.name, t);
  }
}

function chooseSkill(f: FighterState, t: number): Skill | undefined {
  if (isSilenced(f.effects, t)) return undefined;
  return f.unit.skills.find((skill) => {
    if ((f.cooldowns.get(skill.id) ?? 0) > t) return false;
    if (mpCost(f, skill) > f.mp) return false;
    if (skill.weaponKind && f.unit.weapon?.kind !== skill.weaponKind) return false;
    // 純治療技：血量還很滿就不浪費
    if (!skill.damage && skill.heal && f.hp > f.maxHp * 0.7) return false;
    return true;
  });
}

function takeTurn(battle: Battle, f: FighterState, foe: FighterState, t: number): void {
  purgeExpired(f.effects, t);

  // 冰凍／暈眩：不能行動，輪詢到解除
  const incap = incapacitatedBy(f.effects, t);
  if (incap) {
    f.nextActionAt = Math.min(incap.expiresAt, t + 0.25) + 0.01;
    return;
  }

  // 詠唱完成 → 出手才扣資源（被打斷不扣）
  if (f.casting) {
    const skill = f.casting.skill;
    f.casting = null;
    f.mp -= mpCost(f, skill);
    f.cooldowns.set(skill.id, t + skill.cooldown);
    resolveOffense(battle, f, foe, skill, t);
    f.nextActionAt = t + currentInterval(f);
    return;
  }

  const skill = chooseSkill(f, t);
  if (skill) {
    const cast = castDuration(f, skill);
    if (cast > 0) {
      f.casting = { skill, finishAt: t + cast };
      f.nextActionAt = t + cast;
      battle.push({
        t,
        kind: 'cast',
        side: f.side,
        text: `${f.unit.name} 詠唱【${skill.name}】${fmt(cast)}s`,
        duration: cast,
      });
    } else {
      f.mp -= mpCost(f, skill);
      f.cooldowns.set(skill.id, t + skill.cooldown);
      resolveOffense(battle, f, foe, skill, t);
      f.nextActionAt = t + currentInterval(f);
    }
    return;
  }

  // 普攻：空手不是武器——沒有武器就沒有普攻
  if (f.unit.weapon) {
    resolveOffense(battle, f, foe, undefined, t);
    f.nextActionAt = t + currentInterval(f);
    return;
  }
  f.nextActionAt = t + 0.5;
}

/** 處理持續跳動效果；回傳 true 表示有人倒下 */
function processTicks(battle: Battle, f: FighterState, t: number): boolean {
  for (const effect of f.effects) {
    if (effect.nextTickAt === undefined || effect.nextTickAt > t || effect.nextTickAt > effect.expiresAt) continue;
    const def = EFFECT_BY_NAME.get(effect.name);
    if (!def?.tick) continue;
    const raw = def.tick.unit === '點' ? effect.value : (f.maxHp * effect.value) / 100;
    const amount = Math.max(1, Math.round(raw));
    effect.nextTickAt += 1;

    if (def.tick.direction < 0) {
      f.hp -= amount;
      const hpAfter = Math.max(0, f.hp);
      battle.push({ t, kind: 'dot', side: f.side, text: `【${effect.name}】${f.unit.name} −${amount}（${hpAfter}）`, hpAfter });
      const broken = absorbBreakDamage(f.effects, amount);
      if (broken) {
        battle.push({ t, kind: 'status', side: f.side, text: `${f.unit.name} 的【${broken}】被打破` });
      }
      if (f.hp <= 0) {
        battle.push({ t, kind: 'death', side: f.side, text: `${f.unit.name} 倒下`, hpAfter: 0 });
        return true;
      }
    } else {
      f.hp = Math.min(f.maxHp, f.hp + amount);
      battle.push({ t, kind: 'heal', side: f.side, text: `【${effect.name}】${f.unit.name} ＋${amount}（${f.hp}）`, hpAfter: f.hp });
    }
  }
  purgeExpired(f.effects, t);
  return false;
}

/**
 * 連續時間軸的自動戰鬥模擬：純函式，不依賴任何環境。
 * 第一階段骰攻擊表、第二階段算傷害（破防、減算、減成、折減），
 * 效果系統（修飾、跳動、開關）與抗性全部生效。
 */
export function simulateBattle(
  player: Unit,
  enemy: Unit,
  rng: Rng,
  opts: { playerStartHp?: number; playerStartMp?: number } = {},
): BattleResult {
  const makeState = (unit: Unit, side: Side): FighterState => {
    const hpMax = maxHp(unit.attrs.vit);
    const mpMax = maxMp(unit.attrs.wil);
    return {
      side,
      unit,
      maxHp: hpMax,
      maxMp: mpMax,
      hp: hpMax,
      mp: mpMax,
      nextActionAt: 0.2 + rng() * 0.2,
      casting: null,
      cooldowns: new Map(),
      effects: [],
    };
  };

  const p = makeState(player, 'player');
  const e = makeState(enemy, 'enemy');
  if (opts.playerStartHp !== undefined) p.hp = Math.min(p.maxHp, opts.playerStartHp);
  if (opts.playerStartMp !== undefined) p.mp = Math.min(p.maxMp, opts.playerStartMp);

  const events: BattleEvent[] = [];
  const battle: Battle = { rng, events, push: (event) => events.push(event) };
  const fighters = [p, e];
  let t = 0;

  const finish = (winner: Side): BattleResult => ({
    winner,
    durationSeconds: t,
    playerHpLeft: Math.max(0, p.hp),
    playerMpLeft: Math.max(0, p.mp),
    events,
    log: events.map((ev) => `[${ev.t.toFixed(1).padStart(5)}s] ${ev.text}`),
  });

  while (t < MAX_TIME) {
    const times: number[] = [];
    for (const f of fighters) {
      times.push(f.nextActionAt);
      for (const effect of f.effects) {
        if (effect.nextTickAt !== undefined && effect.nextTickAt <= effect.expiresAt) {
          times.push(effect.nextTickAt);
        }
      }
    }
    const tNext = Math.min(...times);
    if (tNext > MAX_TIME) break;
    t = tNext;

    for (const f of fighters) {
      if (processTicks(battle, f, t)) {
        return finish(f === e ? 'player' : 'enemy');
      }
    }

    const due = fighters.filter((f) => f.nextActionAt <= t + 1e-9);
    if (due.length === 2 && rng() < 0.5) due.reverse();
    for (const f of due) {
      if (f.hp <= 0) continue;
      const foe = f === p ? e : p;
      takeTurn(battle, f, foe, t);
      if (foe.hp <= 0) return finish(foe === e ? 'player' : 'enemy');
      if (f.hp <= 0) return finish(f === e ? 'player' : 'enemy');
    }
  }

  battle.push({ t: MAX_TIME, kind: 'system', side: 'none', text: `超過 ${MAX_TIME} 秒，視為落敗` });
  return finish('enemy');
}
