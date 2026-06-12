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

  it('沒有預設數值：全部歸零＝100% 命中', () => {
    const zero = { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 0 };
    const table = buildAttackTable({ attacker: zero, defender: zero, defenderHasShield: false });
    expect(table).toEqual([{ outcome: '命中', width: 1 }]);
  });

  it('躲避＝12% × 幸運 ÷（幸運＋128）：飽和曲線', () => {
    const at = (luk: number) =>
      buildAttackTable({ attacker: attrs(), defender: attrs({ luk }), defenderHasShield: false })
        .find((s) => s.outcome === '躲避')?.width ?? 0;
    expect(at(128)).toBeCloseTo(0.06, 10);
    expect(at(255)).toBeCloseTo((0.12 * 255) / 383, 10); // ≈ 8%
    // 前段便宜、後段昂貴：0→128 賺到的躲避多於 128→255
    expect(at(128) - at(0)).toBeGreaterThan(at(255) - at(128));
  });

  it('躲避擲得出來', () => {
    const table = buildAttackTable({
      attacker: attrs({ dex: 255 }),
      defender: attrs({ luk: 255 }),
      defenderHasShield: false,
    });
    const rng = createRng(7);
    const outcomes = new Set(Array.from({ length: 500 }, () => rollOutcome(table, rng)));
    expect(outcomes.has('躲避')).toBe(true);
  });
});
