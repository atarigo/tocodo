import { describe, expect, it } from 'vitest';
import { buildAttackTable, resolveDamage, rollOutcome } from '../src/core/attackTable.js';
import { createRng } from '../src/core/rng.js';
import type { Attributes } from '../src/core/types.js';

function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10, ...overrides };
}

describe('攻擊表', () => {
  it('所有段的寬度加總必為 100%', () => {
    const table = buildAttackTable({ attacker: attrs(), defender: attrs(), defenderParryRate: 0, defenderBlockRate: 0 });
    const total = table.reduce((sum, s) => sum + s.width, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('沒有預設數值：全部歸零＝100% 命中', () => {
    const zero = { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 0 };
    const table = buildAttackTable({ attacker: zero, defender: zero, defenderParryRate: 0, defenderBlockRate: 0 });
    expect(table).toEqual([{ outcome: '命中', width: 1 }]);
  });

  it('躲避＝12% × 幸運 ÷（幸運＋128）：飽和曲線', () => {
    const at = (luk: number) =>
      buildAttackTable({ attacker: attrs(), defender: attrs({ luk }), defenderParryRate: 0, defenderBlockRate: 0 })
        .find((s) => s.outcome === '躲避')?.width ?? 0;
    expect(at(128)).toBeCloseTo(0.06, 10);
    expect(at(255)).toBeCloseTo((0.12 * 255) / 383, 10); // ≈ 8%
    // 前段便宜、後段昂貴：0→128 賺到的躲避多於 128→255
    expect(at(128) - at(0)).toBeGreaterThan(at(255) - at(128));
  });

  it('閃避：靈巧最多壓掉一半，防禦永遠還在', () => {
    const dodge = (agi: number, dex: number) =>
      buildAttackTable({
        attacker: attrs({ dex }),
        defender: attrs({ agi, luk: 0 }),
        defenderParryRate: 0, defenderBlockRate: 0,
      }).find((s) => s.outcome === '閃避')?.width ?? 0;
    expect(dodge(255, 0)).toBeCloseTo(0.4, 10); // 敏捷滿、無壓制
    expect(dodge(255, 255)).toBeCloseTo(0.2, 10); // 雙方點滿 → 砍半，不歸零
    expect(dodge(0, 0)).toBe(0); // 沒投資就沒有
    expect(dodge(200, 150)).toBeLessThan(dodge(200, 10)); // 靈巧仍有壓制效果
  });

  it('招架與格檔：率直接來自裝備，屬性不提供', () => {
    const zero = { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 0 };
    const bare = buildAttackTable({ attacker: zero, defender: zero, defenderParryRate: 0, defenderBlockRate: 0 });
    expect(bare.find((s) => s.outcome === '招架')).toBeUndefined();
    expect(bare.find((s) => s.outcome === '格檔')).toBeUndefined();

    const armed = buildAttackTable({
      attacker: zero,
      defender: zero,
      defenderParryRate: 0.25,
      defenderBlockRate: 0.45,
    });
    expect(armed.find((s) => s.outcome === '招架')?.width).toBeCloseTo(0.25, 10);
    expect(armed.find((s) => s.outcome === '格檔')?.width).toBeCloseTo(0.45, 10);
    expect(armed.find((s) => s.outcome === '命中')?.width).toBeCloseTo(0.3, 10);
  });

  it('攻擊宣告：槍不可暴擊、法術不可被招架、頭目普攻帶碾壓', () => {
    const zero = { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 255 };
    const gun = buildAttackTable({
      attacker: zero, defender: zero,
      defenderParryRate: 0.2, defenderBlockRate: 0,
      attackerCanCrit: false,
    });
    expect(gun.find((s) => s.outcome === '暴擊')).toBeUndefined();

    const spell = buildAttackTable({
      attacker: zero, defender: zero,
      defenderParryRate: 0.2, defenderBlockRate: 0.4,
      canBeParried: false,
    });
    expect(spell.find((s) => s.outcome === '招架')).toBeUndefined();
    expect(spell.find((s) => s.outcome === '格檔')?.width).toBeCloseTo(0.4, 10);

    const boss = buildAttackTable({
      attacker: zero, defender: zero,
      defenderParryRate: 0, defenderBlockRate: 0,
      attackerCrushRate: 0.15,
    });
    expect(boss.find((s) => s.outcome === '碾壓')?.width).toBeCloseTo(0.15, 10);
  });

  it('第二階段：增傷先乘 → 破防 → 減算 → 減成 → 招架/格檔折減', () => {
    const defense = { armor: 20, reductionRate: 0.5 };
    expect(resolveDamage('命中', 100, defense).damage).toBe(40); // (100−20)×0.5
    expect(resolveDamage('暴擊', 100, defense).damage).toBe(65); // (150−20)×0.5
    expect(resolveDamage('碾壓', 100, defense).damage).toBe(90); // (200−20)×0.5
    expect(resolveDamage('招架', 100, defense).damage).toBe(28); // 40×0.7
    expect(resolveDamage('格檔', 100, defense).damage).toBe(16); // 40×0.4
    expect(resolveDamage('閃避', 100, defense).damage).toBe(0);
    expect(resolveDamage('命中', 100, defense, 1.5).damage).toBe(65); // 增傷 +50% 先乘
  });

  it('未破防：來襲傷害 ≤ 護甲值總和 → 傷害 1、特效不發動；暴擊可幫助破防', () => {
    const defense = { armor: 20, reductionRate: 0 };
    const blocked = resolveDamage('命中', 15, defense);
    expect(blocked.damage).toBe(1);
    expect(blocked.brokeDefense).toBe(false);
    // 同樣 15 點基礎傷害，暴擊 ×1.5 ＝ 22.5 > 20，破防
    const crit = resolveDamage('暴擊', 15, defense);
    expect(crit.brokeDefense).toBe(true);
    expect(crit.damage).toBe(3); // 22.5 − 20 ＝ 2.5 → round 3
  });

  it('躲避擲得出來', () => {
    const table = buildAttackTable({
      attacker: attrs({ dex: 255 }),
      defender: attrs({ luk: 255 }),
      defenderParryRate: 0, defenderBlockRate: 0,
    });
    const rng = createRng(7);
    const outcomes = new Set(Array.from({ length: 500 }, () => rollOutcome(table, rng)));
    expect(outcomes.has('躲避')).toBe(true);
  });
});
