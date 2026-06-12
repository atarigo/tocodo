import type { DefenseProfile, Skill, StatusApplication, SkillDamage, Unit, Weapon, Attributes } from './types.js';
import { deriveStats, midRoll, rollSpread, type Derived } from './attributes.js';
import {
  applyStatus,
  defFlatReduction,
  purgeExpired,
  slowMultiplier,
  stunnedUntil,
  type StatusInstance,
} from './effects.js';
import type { Rng } from './rng.js';

/** 戰鬥時間上限（秒）：拖過視為玩家落敗 */
const MAX_TIME = 90;

export type Side = 'player' | 'enemy';

export type EventKind =
  | 'cast'
  | 'miss'
  | 'hurt'
  | 'dot'
  | 'heal'
  | 'status'
  | 'stun'
  | 'death'
  | 'system';

/** 帶時間戳的結構化戰鬥事件，供網頁回放動畫；text 供純文字介面 */
export interface BattleEvent {
  t: number;
  kind: EventKind;
  /** 事件的受身方（hurt/dot = 受傷者、heal = 回復者、cast = 詠唱者…） */
  side: Side | 'none';
  text: string;
  /** hurt / dot / heal 後的剩餘生命，供血條同步 */
  hpAfter?: number;
}

export interface BattleResult {
  winner: Side;
  durationSeconds: number;
  playerHpLeft: number;
  playerMpLeft: number;
  events: BattleEvent[];
  log: string[];
}

interface OffenseSpec {
  label: string;
  hitAttr: 'agi' | 'dex' | null;
  damage?: SkillDamage;
  heal?: { base: number; scaling?: Partial<Attributes> };
  applies?: StatusApplication[];
}

interface FighterState {
  side: Side;
  unit: Unit;
  derived: Derived;
  hp: number;
  mp: number;
  nextActionAt: number;
  casting: { skill: Skill; finishAt: number } | null;
  cooldowns: Map<string, number>;
  statuses: StatusInstance[];
}

export interface DamageContext {
  raw: number;
  defense: DefenseProfile;
  /** 破甲等效果對減算的扣減 */
  defFlatReduction: number;
  parried: boolean;
  /** 招架減傷依力量 */
  defenderStr: number;
  pierce?: boolean;
  trueDamage?: boolean;
}

/**
 * 防禦結算：減算（−）→ 減成（％）。
 * 穿透不計任何減算（含招架的力量減傷），仍吃減成；真傷不計一切。
 */
export function computeFinalDamage(ctx: DamageContext): number {
  if (ctx.trueDamage) return Math.max(1, Math.round(ctx.raw));
  const pct = Math.min(0.8, ctx.defense.pct + (ctx.parried ? ctx.defense.parryPct : 0));
  if (ctx.pierce) return Math.max(1, Math.round(ctx.raw * (1 - pct)));
  const flat =
    Math.max(0, ctx.defense.flat - ctx.defFlatReduction) +
    (ctx.parried ? ctx.defense.parryFlat + ctx.defenderStr * 0.5 : 0);
  return Math.max(1, Math.round((ctx.raw - flat) * (1 - pct)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 出手間隔：武器基礎 ÷ 敏捷加速（若武器吃敏捷）× 冰緩等減速 */
function currentInterval(f: FighterState): number {
  const w = f.unit.weapon;
  const agiMult = w.agiSpeed ? 1 + f.unit.attrs.agi * 0.02 : 1;
  return (w.interval / agiMult) * slowMultiplier(f.statuses);
}

function autoAttackSpec(weapon: Weapon): OffenseSpec {
  return {
    label: weapon.name,
    hitAttr: 'dex',
    damage: {
      base: 0,
      weaponMult: 1,
      spread: weapon.dexSpread,
      scaling: { str: weapon.strScaling },
      // 槍的普攻只有要害沒有暴擊
      canCrit: weapon.kind !== '槍',
    },
  };
}

function skillSpec(skill: Skill): OffenseSpec {
  return {
    label: skill.name,
    hitAttr: skill.hitAttr,
    damage: skill.damage,
    heal: skill.heal,
    applies: skill.applies,
  };
}

interface Battle {
  rng: Rng;
  events: BattleEvent[];
  push: (t: number, kind: EventKind, side: Side | 'none', text: string, hpAfter?: number) => void;
}

function resolveOffense(
  battle: Battle,
  attacker: FighterState,
  defender: FighterState,
  spec: OffenseSpec,
  t: number,
): void {
  const { rng, push } = battle;
  const aName = attacker.unit.name;
  const dName = defender.unit.name;
  let parried = false;

  // 命中管線：躲避（幸運）→ 閃避（無傷無效果）→ 招架（效果照發、傷害另計）
  if (spec.hitAttr !== null && spec.damage) {
    if (rng() < defender.derived.luckyEvade) {
      push(t, 'miss', defender.side, `${aName} 的【${spec.label}】落空——幸運使然，${dName} 險險躲過`);
      return;
    }
    const accuracy = clamp(
      0.9 + attacker.unit.attrs[spec.hitAttr] * 0.005 - defender.derived.dodge,
      0.2,
      0.98,
    );
    if (rng() >= accuracy) {
      push(t, 'miss', defender.side, `${dName} 閃避了 ${aName} 的【${spec.label}】`);
      return;
    }
    parried = rng() < defender.derived.parry;
  }

  if (spec.damage) {
    const d = spec.damage;
    let weaponPart = 0;
    if (d.weaponMult) {
      const roll = d.spread
        ? rollSpread(rng, attacker.unit.weapon.damage, attacker.derived.spreadExp)
        : midRoll(attacker.unit.weapon.damage);
      weaponPart = roll * d.weaponMult;
    }
    let raw = d.base + weaponPart;
    for (const [attr, coef] of Object.entries(d.scaling ?? {})) {
      raw += attacker.unit.attrs[attr as keyof Attributes] * (coef ?? 0);
    }
    raw *= attacker.unit.damageMult;

    let critText = '';
    if (rng() < attacker.derived.vitalChance) {
      raw *= 2.5;
      critText = '擊中要害！';
    } else if (d.canCrit && rng() < attacker.derived.critChance) {
      raw *= 1.5;
      critText = '暴擊！';
    }

    const final = computeFinalDamage({
      raw,
      defense: defender.unit.defense,
      defFlatReduction: defFlatReduction(defender.statuses),
      parried,
      defenderStr: defender.unit.attrs.str,
      pierce: d.pierce,
      trueDamage: d.trueDamage,
    });
    defender.hp -= final;
    const hpAfter = Math.max(0, defender.hp);
    if (parried) {
      push(t, 'hurt', defender.side, `${dName} 招架住【${spec.label}】，${critText}仍受到 ${final} 傷害（剩 ${hpAfter}）`, hpAfter);
    } else {
      push(t, 'hurt', defender.side, `${aName} 的【${spec.label}】命中，${critText}造成 ${final} 傷害（剩 ${hpAfter}）`, hpAfter);
    }
    if (defender.hp <= 0) {
      push(t, 'death', defender.side, `${dName} 倒下了！`, 0);
      return;
    }
  }

  // 效果結算：閃避＝無效果（前面已 return）；招架＝效果照發
  if (spec.heal) {
    let amount = spec.heal.base;
    for (const [attr, coef] of Object.entries(spec.heal.scaling ?? {})) {
      amount += attacker.unit.attrs[attr as keyof Attributes] * (coef ?? 0);
    }
    const healed = Math.round(amount);
    attacker.hp = Math.min(attacker.derived.maxHp, attacker.hp + healed);
    push(t, 'heal', attacker.side, `${aName} 回復 ${healed} 生命（剩 ${attacker.hp}）`, attacker.hp);
  }
  for (const app of spec.applies ?? []) {
    const result = applyStatus(defender.statuses, app, t, defender.derived);
    if (result.outcome === 'blocked') {
      push(t, 'status', defender.side, `${dName} 身上的既有效果優先度更高，【${app.statusId}】未能覆蓋`);
    } else {
      push(t, 'status', defender.side, `${dName} 陷入【${app.statusId}】（${result.duration.toFixed(1)} 秒）`);
    }
  }
}

function takeTurn(battle: Battle, f: FighterState, foe: FighterState, t: number): void {
  const { push } = battle;
  const stunEnd = stunnedUntil(f.statuses, t);
  if (!f.casting && stunEnd !== null) {
    push(t, 'stun', f.side, `${f.unit.name} 昏迷中，無法行動`);
    f.nextActionAt = stunEnd + 0.05;
    return;
  }

  if (f.casting) {
    const skill = f.casting.skill;
    f.casting = null;
    resolveOffense(battle, f, foe, skillSpec(skill), t);
    f.nextActionAt = t + currentInterval(f);
    return;
  }

  // 自動戰鬥決策：技能欄由前往後找第一個可用的，否則普攻
  const weapon = f.unit.weapon;
  const usable = f.unit.skills.find((s) => {
    if ((f.cooldowns.get(s.id) ?? 0) > t) return false;
    if (s.mpCost * (weapon.mpCostMult ?? 1) > f.mp) return false;
    if (s.weaponKind && weapon.kind !== s.weaponKind) return false;
    // 純治療技：血量還很滿就不浪費
    if (!s.damage && s.heal && f.hp > f.derived.maxHp * 0.7) return false;
    return true;
  });

  if (usable) {
    f.mp -= usable.mpCost * (weapon.mpCostMult ?? 1);
    f.cooldowns.set(usable.id, t + usable.cooldown);
    const castTime = usable.castTime * (weapon.castTimeMult ?? 1);
    if (castTime > 0) {
      f.casting = { skill: usable, finishAt: t + castTime };
      push(t, 'cast', f.side, `${f.unit.name} 開始詠唱【${usable.name}】（${castTime.toFixed(1)} 秒）`);
    } else {
      resolveOffense(battle, f, foe, skillSpec(usable), t);
      f.nextActionAt = t + currentInterval(f);
    }
    return;
  }

  resolveOffense(battle, f, foe, autoAttackSpec(weapon), t);
  f.nextActionAt = t + currentInterval(f);
}

/**
 * 連續時間軸的自動戰鬥模擬：純函式，不依賴任何環境。
 * 每個單位依自己的出手間隔排程，詠唱、冷卻、buff/debuff 都以秒計。
 */
export function simulateBattle(
  player: Unit,
  enemy: Unit,
  rng: Rng,
  opts: { playerStartHp?: number; playerStartMp?: number } = {},
): BattleResult {
  const makeState = (unit: Unit, side: Side): FighterState => {
    const derived = deriveStats(unit.attrs);
    return {
      side,
      unit,
      derived,
      hp: derived.maxHp,
      mp: derived.maxMp,
      nextActionAt: 0.2 + rng() * 0.2,
      casting: null,
      cooldowns: new Map(),
      statuses: [],
    };
  };

  const p = makeState(player, 'player');
  const e = makeState(enemy, 'enemy');
  if (opts.playerStartHp !== undefined) p.hp = Math.min(p.derived.maxHp, opts.playerStartHp);
  if (opts.playerStartMp !== undefined) p.mp = Math.min(p.derived.maxMp, opts.playerStartMp);

  const events: BattleEvent[] = [];
  const battle: Battle = {
    rng,
    events,
    push: (t, kind, side, text, hpAfter) => events.push({ t, kind, side, text, hpAfter }),
  };

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
      times.push(f.casting ? f.casting.finishAt : f.nextActionAt);
      for (const s of f.statuses) {
        if (s.nextTickAt !== undefined && s.nextTickAt <= s.expiresAt) times.push(s.nextTickAt);
      }
    }
    const tNext = Math.min(...times);
    if (tNext > MAX_TIME) break;

    for (const f of fighters) {
      f.mp = Math.min(f.derived.maxMp, f.mp + (tNext - t) * f.derived.mpRegen);
    }
    t = tNext;

    // 持續傷害先跳，再清過期效果
    for (const f of fighters) {
      for (const s of f.statuses) {
        if (s.nextTickAt !== undefined && s.nextTickAt <= t && s.nextTickAt <= s.expiresAt) {
          const dmg = Math.max(1, Math.round(s.magnitude));
          f.hp -= dmg;
          const hpAfter = Math.max(0, f.hp);
          battle.push(t, 'dot', f.side, `${f.unit.name} 因【${s.defId}】受到 ${dmg} 傷害（剩 ${hpAfter}）`, hpAfter);
          s.nextTickAt += 1;
        }
      }
      purgeExpired(f.statuses, t);
      if (f.hp <= 0) {
        battle.push(t, 'death', f.side, `${f.unit.name} 倒下了！`, 0);
        return finish(f === e ? 'player' : 'enemy');
      }
    }

    // 行動（兩人同時到期時隨機先後）
    const due = fighters.filter((f) => (f.casting ? f.casting.finishAt : f.nextActionAt) <= t + 1e-9);
    if (due.length === 2 && rng() < 0.5) due.reverse();
    for (const f of due) {
      if (f.hp <= 0) continue;
      const foe = f === p ? e : p;
      takeTurn(battle, f, foe, t);
      if (foe.hp <= 0) return finish(foe === e ? 'player' : 'enemy');
      if (f.hp <= 0) return finish(f === e ? 'player' : 'enemy');
    }
  }

  battle.push(MAX_TIME, 'system', 'none', `戰鬥拖過 ${MAX_TIME} 秒，視為落敗。`);
  return finish('enemy');
}
