import { EFFECT_BY_NAME, type ModifiableValue } from './effectRegistry.js';
import { debuffDuration, poisonApplyChance } from './formulas.js';
import type { EffectSpec } from './types.js';
import type { Rng } from './rng.js';

/**
 * 戰鬥中掛在單位身上的效果實體。
 * 同名唯一：高級覆蓋低級、同級刷新時間、低級無效（但施放方照樣轉冷卻扣精神）。
 */
export interface ActiveEffect {
  name: string;
  priority: number;
  value: number;
  expiresAt: number;
  /** 持續跳動型：下一次結算時間 */
  nextTickAt?: number;
  /** 冰凍／暈眩：累積受到此量傷害即解除（最大生命 20%） */
  breakPoolLeft?: number;
}

export type ApplyOutcome = 'applied' | 'replaced' | 'refreshed' | 'blocked' | 'resisted';

export interface ApplyResult {
  outcome: ApplyOutcome;
  /** 抗性結算後的實際持續秒數 */
  duration: number;
}

/** 是否為有害效果（debuff）：持續時間吃意志縮短的判定依據 */
export function isDebuff(name: string): boolean {
  const def = EFFECT_BY_NAME.get(name);
  if (!def) return false;
  if (def.modifier) return def.modifier.direction === -1;
  if (def.tick) return def.tick.direction === -1;
  return def.kind === '狀態開關'; // 冰凍、暈眩、沉默都是有害的
}

export function applyEffect(
  effects: ActiveEffect[],
  spec: EffectSpec,
  now: number,
  target: { wil: number; vit: number; maxHp: number },
  rng: Rng,
): ApplyResult {
  const def = EFFECT_BY_NAME.get(spec.name);
  if (!def) return { outcome: 'resisted', duration: 0 };

  // 毒系：體質折減附加成功率（傷害本身不受體質影響）
  if (def.tick?.poison && rng() >= poisonApplyChance(1, target.vit)) {
    return { outcome: 'resisted', duration: 0 };
  }

  const duration = isDebuff(spec.name)
    ? debuffDuration(spec.duration, target.wil)
    : spec.duration;

  const existing = effects.find((e) => e.name === spec.name);
  if (existing) {
    if (existing.priority > spec.priority) return { outcome: 'blocked', duration: 0 };
    const outcome: ApplyOutcome = existing.priority === spec.priority ? 'refreshed' : 'replaced';
    existing.priority = spec.priority;
    existing.value = spec.value;
    existing.expiresAt = now + duration;
    if (def.kind === '狀態開關' && (spec.name === '冰凍' || spec.name === '暈眩')) {
      existing.breakPoolLeft = target.maxHp * 0.2;
    }
    return { outcome, duration };
  }

  effects.push({
    name: spec.name,
    priority: spec.priority,
    value: spec.value,
    expiresAt: now + duration,
    nextTickAt: def.kind === '持續跳動' ? now + 1 : undefined,
    breakPoolLeft:
      spec.name === '冰凍' || spec.name === '暈眩' ? target.maxHp * 0.2 : undefined,
  });
  return { outcome: 'applied', duration };
}

export function purgeExpired(effects: ActiveEffect[], now: number): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].expiresAt <= now) effects.splice(i, 1);
  }
}

/**
 * 統一修飾規則：實際值 ＝（基準 ＋ 固定值加總）×（1 ＋ 比例加總），最低 0。
 */
export function modifiedValue(base: number, effects: ActiveEffect[], target: ModifiableValue): number {
  let flat = 0;
  let pct = 0;
  for (const active of effects) {
    const def = EFFECT_BY_NAME.get(active.name);
    if (!def?.modifier || def.modifier.target !== target) continue;
    const signed = def.modifier.direction * active.value;
    if (def.modifier.unit === '點') flat += signed;
    else pct += signed / 100;
  }
  return Math.max(0, (base + flat) * (1 + pct));
}

/** 行動不能（冰凍／暈眩）中？回傳生效中的效果 */
export function incapacitatedBy(effects: ActiveEffect[], now: number): ActiveEffect | null {
  return (
    effects.find(
      (e) => (e.name === '冰凍' || e.name === '暈眩') && e.expiresAt > now,
    ) ?? null
  );
}

export function isSilenced(effects: ActiveEffect[], now: number): boolean {
  return effects.some((e) => e.name === '沉默' && e.expiresAt > now);
}

/**
 * 冰凍／暈眩的破除：受到傷害就消耗破除池，耗盡即解除。
 * 回傳被破除的效果名稱（沒有則 null）。
 */
export function absorbBreakDamage(effects: ActiveEffect[], damage: number): string | null {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (effect.breakPoolLeft === undefined) continue;
    effect.breakPoolLeft -= damage;
    if (effect.breakPoolLeft <= 0) {
      effects.splice(i, 1);
      return effect.name;
    }
  }
  return null;
}
