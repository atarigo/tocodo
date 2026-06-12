import { describe, expect, it } from 'vitest';
import { buildAttackTable, rollOutcome } from '../src/core/attackTable.js';
import { createRng } from '../src/core/rng.js';
import type { Attributes } from '../src/core/types.js';

function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10, ...overrides };
}

describe('攻擊表', () => {
  it('所有段的寬度加總必為 100%', () => {
    const table = buildAttackTable({ attacker: attrs(), defender: attrs(), defenderHasShield: false });
    const total = table.reduce((sum, s) => sum + s.width, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('第 0 步：空表，每一刀都命中', () => {
    const table = buildAttackTable({ attacker: attrs(), defender: attrs({ agi: 99, luk: 99 }), defenderHasShield: true });
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      expect(rollOutcome(table, rng)).toBe('命中');
    }
  });
});
