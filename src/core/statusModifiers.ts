import type { Modifier } from './modifiers.js';
import type { StatusEffect } from './types.js';
import { statusById } from '../data/statusCatalog.js';

export function statusEffectsToModifiers(effects: StatusEffect[], targetId: number): Modifier[] {
  const result: Modifier[] = [];

  for (const effect of effects) {
    if (effect.targetId !== targetId) continue;
    if (effect.type !== 'modifier') continue;

    const status = statusById(effect.statusId);
    if (!status.target || !status.unit) continue;

    const value = effect.amountPerTick * effect.stacks;

    if (status.unit === 'flat') {
      const sign = status.direction === 'debuff' ? -1 : 1;
      result.push({
        source: `status:${effect.statusId}:${effect.sourceId}`,
        target: status.target,
        op: '+',
        value: sign * value,
      });
    } else if (status.unit === 'ratio') {
      const factor = status.direction === 'debuff' ? 1 - value : 1 + value;
      result.push({
        source: `status:${effect.statusId}:${effect.sourceId}`,
        target: status.target,
        op: '×more',
        value: factor,
      });
    }
  }

  return result;
}
