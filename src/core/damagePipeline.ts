import type { AttackOutcome } from './attackTable.js';
import { CRIT_MULTIPLIER, CRUSH_MULTIPLIER, PARRY_DAMAGE_REDUCTION, BLOCK_DAMAGE_REDUCTION } from './attackTable.js';
import type { Modifier } from './modifiers.js';
import { collectModifiers, resolveModifiers } from './modifiers.js';
import type { Tag } from './tags.js';

export interface DamageContext {
  modifierSources: Modifier[][];
  skillTags?: Tag[];
  outcome: AttackOutcome;
  baseArmor: number;
  baseReductionRate: number;
  trueDamage?: number;
}

export interface DamageOutput {
  damage: number;
  brokeDefense: boolean;
  outcome: AttackOutcome;
}

export function calculateDamage(ctx: DamageContext): DamageOutput {
  const { outcome } = ctx;

  if (outcome === '閃避' || outcome === '躲避') {
    return { damage: 0, brokeDefense: false, outcome };
  }

  if (ctx.trueDamage !== undefined && ctx.trueDamage > 0) {
    return { damage: ctx.trueDamage, brokeDefense: true, outcome };
  }

  const grouped = collectModifiers(ctx.modifierSources, ctx.skillTags);

  const base = resolveModifiers(grouped.get('damage.base') ?? [], 0);
  const flat = resolveModifiers(grouped.get('damage.flat') ?? [], 0);
  const mult = resolveModifiers(grouped.get('damage.mult') ?? [], 1);

  let incoming = (base + flat) * mult;

  const moreMods = grouped.get('damage.more') ?? [];
  for (const mod of moreMods) {
    incoming *= mod.value;
  }

  if (outcome === '暴擊') incoming *= CRIT_MULTIPLIER;
  if (outcome === '碾壓') incoming *= CRUSH_MULTIPLIER;

  const penetration = Math.min(1, Math.max(0, resolveModifiers(grouped.get('attack.armorPenetration') ?? [], 0)));

  const armorMods = grouped.get('defense.armor') ?? [];
  const effectiveArmor = Math.max(0, resolveModifiers(armorMods, ctx.baseArmor)) * (1 - penetration);

  if (incoming <= effectiveArmor / 3) return { damage: 0, brokeDefense: false, outcome };
  if (incoming <= effectiveArmor) return { damage: 1, brokeDefense: false, outcome };

  const rateMods = grouped.get('defense.reductionRate') ?? [];
  const effectiveRate = Math.max(0, resolveModifiers(rateMods, ctx.baseReductionRate));

  let damage = (incoming - effectiveArmor) * (1 - effectiveRate);

  if (outcome === '招架') damage *= 1 - PARRY_DAMAGE_REDUCTION;
  if (outcome === '格檔') damage *= 1 - BLOCK_DAMAGE_REDUCTION;

  return { damage: Math.max(1, Math.round(damage)), brokeDefense: true, outcome };
}
