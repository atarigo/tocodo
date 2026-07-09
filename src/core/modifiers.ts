import type { Tag } from './tags.js';

export type ModifierAppliesTo = 'all' | 'player' | 'enemy';

export interface Modifier {
  source: string;
  target: string;
  op: '=' | '+' | '×' | '×more';
  value: number;
  condition?: ModifierCondition;
  appliesTo?: ModifierAppliesTo;
}

export interface ModifierCondition {
  skillHasTag?: Tag;
}

export function collectModifiers(
  sources: Modifier[][],
  skillTags?: Tag[],
): Map<string, Modifier[]> {
  const grouped = new Map<string, Modifier[]>();

  for (const modifiers of sources) {
    for (const mod of modifiers) {
      if (mod.condition && !matchesCondition(mod.condition, skillTags)) {
        continue;
      }
      let list = grouped.get(mod.target);
      if (!list) {
        list = [];
        grouped.set(mod.target, list);
      }
      list.push(mod);
    }
  }

  return grouped;
}

function matchesCondition(
  condition: ModifierCondition,
  skillTags?: Tag[],
): boolean {
  if (condition.skillHasTag) {
    if (!skillTags || !skillTags.includes(condition.skillHasTag)) return false;
  }
  return true;
}

export function resolveModifiers(
  modifiers: Modifier[],
  baseValue = 0,
): number {
  let value = baseValue;

  const bases: number[] = [];
  const flats: number[] = [];
  const mults: number[] = [];
  const mores: number[] = [];

  for (const mod of modifiers) {
    switch (mod.op) {
      case '=':
        bases.push(mod.value);
        break;
      case '+':
        flats.push(mod.value);
        break;
      case '×':
        mults.push(mod.value);
        break;
      case '×more':
        mores.push(mod.value);
        break;
    }
  }

  if (bases.length > 0) {
    value = bases[bases.length - 1];
  }

  for (const flat of flats) {
    value += flat;
  }

  for (const mult of mults) {
    value *= mult;
  }

  for (const more of mores) {
    value *= more;
  }

  return Math.max(0, value);
}
