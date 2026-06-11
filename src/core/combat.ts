import type { BuffStat, Combatant, Skill, Tag } from './types.js';
import type { Rng } from './rng.js';

const MAX_ROUNDS = 60;

interface ActiveBuff {
  stat: BuffStat;
  amount: number;
  remaining: number;
}

interface FighterState {
  source: Combatant;
  hp: number;
  cooldowns: number[];
  buffs: ActiveBuff[];
}

export interface BattleResult {
  winner: 'player' | 'enemy';
  rounds: number;
  playerHpLeft: number;
  log: string[];
}

export function synergyBonus(combatant: Combatant, tag: Tag): number {
  return combatant.synergies
    .filter((s) => s.tag === tag)
    .reduce((sum, s) => sum + s.bonus, 0);
}

/** 傷害公式：攻擊 × 倍率 × (1 + 標籤協同) − 防禦，最低 1 點 */
export function computeDamage(
  atk: number,
  multiplier: number,
  synergy: number,
  def: number,
): number {
  return Math.max(1, Math.round(atk * multiplier * (1 + synergy)) - def);
}

function effectiveStat(fighter: FighterState, stat: BuffStat): number {
  const base = fighter.source.stats[stat];
  const bonus = fighter.buffs
    .filter((b) => b.stat === stat)
    .reduce((sum, b) => sum + b.amount, 0);
  return Math.max(0, base + bonus);
}

function tickTurnStart(fighter: FighterState): void {
  fighter.cooldowns = fighter.cooldowns.map((cd) => Math.max(0, cd - 1));
  fighter.buffs = fighter.buffs
    .map((b) => ({ ...b, remaining: b.remaining - 1 }))
    .filter((b) => b.remaining > 0);
}

function chooseSkill(fighter: FighterState): { skill: Skill; index: number } | null {
  for (let i = 0; i < fighter.source.skills.length; i++) {
    if (fighter.cooldowns[i] === 0) {
      return { skill: fighter.source.skills[i], index: i };
    }
  }
  return null;
}

function act(actor: FighterState, target: FighterState, log: string[]): void {
  tickTurnStart(actor);
  const chosen = chooseSkill(actor);
  const atk = effectiveStat(actor, 'atk');
  const targetDef = effectiveStat(target, 'def');

  if (!chosen) {
    const dmg = computeDamage(atk, 1, 0, targetDef);
    target.hp = Math.max(0, target.hp - dmg);
    log.push(`${actor.source.name} 普通攻擊，對 ${target.source.name} 造成 ${dmg} 傷害（剩 ${target.hp}）`);
    return;
  }

  const { skill, index } = chosen;
  actor.cooldowns[index] = skill.cooldown;
  const parts: string[] = [];

  for (const effect of skill.effects) {
    switch (effect.kind) {
      case 'damage': {
        const dmg = computeDamage(atk, effect.multiplier, synergyBonus(actor.source, skill.tag), targetDef);
        target.hp = Math.max(0, target.hp - dmg);
        parts.push(`對 ${target.source.name} 造成 ${dmg} 傷害（剩 ${target.hp}）`);
        break;
      }
      case 'heal': {
        const amount = Math.round(actor.source.stats.maxHp * effect.percentOfMax);
        actor.hp = Math.min(actor.source.stats.maxHp, actor.hp + amount);
        parts.push(`回復 ${amount} 生命（剩 ${actor.hp}）`);
        break;
      }
      case 'buff': {
        actor.buffs.push({ stat: effect.stat, amount: effect.amount, remaining: effect.duration + 1 });
        parts.push(`自身 ${effect.stat} +${effect.amount}（${effect.duration} 回合）`);
        break;
      }
      case 'debuff': {
        target.buffs.push({ stat: effect.stat, amount: -effect.amount, remaining: effect.duration + 1 });
        parts.push(`${target.source.name} ${effect.stat} -${effect.amount}（${effect.duration} 回合）`);
        break;
      }
    }
  }

  log.push(`${actor.source.name} 使用【${skill.name}】，${parts.join('，')}`);
}

/**
 * 自動戰鬥模擬器：純函式，不依賴任何環境。
 * 超過回合上限視為玩家落敗（拖延即淘汰）。
 */
export function simulateBattle(
  player: Combatant,
  enemy: Combatant,
  rng: Rng,
  playerStartHp: number = player.stats.maxHp,
): BattleResult {
  const p: FighterState = { source: player, hp: playerStartHp, cooldowns: player.skills.map(() => 0), buffs: [] };
  const e: FighterState = { source: enemy, hp: enemy.stats.maxHp, cooldowns: enemy.skills.map(() => 0), buffs: [] };
  const log: string[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    log.push(`—— 第 ${round} 回合 ——`);
    const pSpd = effectiveStat(p, 'spd');
    const eSpd = effectiveStat(e, 'spd');
    const playerFirst = pSpd > eSpd || (pSpd === eSpd && rng() < 0.5);
    const order: [FighterState, FighterState][] = playerFirst ? [[p, e], [e, p]] : [[e, p], [p, e]];

    for (const [actor, target] of order) {
      if (actor.hp <= 0) continue;
      act(actor, target, log);
      if (target.hp <= 0) {
        const winner = target === e ? 'player' : 'enemy';
        log.push(`${target.source.name} 倒下了！`);
        return { winner, rounds: round, playerHpLeft: p.hp, log };
      }
    }
  }

  log.push(`戰鬥超過 ${MAX_ROUNDS} 回合，視為落敗。`);
  return { winner: 'enemy', rounds: MAX_ROUNDS, playerHpLeft: p.hp, log };
}
