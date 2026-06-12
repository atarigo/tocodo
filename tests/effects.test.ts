import { describe, expect, it } from 'vitest';
import { EFFECT_BY_NAME, EFFECTS } from '../src/core/effectRegistry.js';
import { debuffDuration, poisonApplyChance } from '../src/core/formulas.js';

describe('效果名錄', () => {
  it('名稱唯一（同名唯一規則的前提）', () => {
    expect(EFFECT_BY_NAME.size).toBe(EFFECTS.length);
  });

  it('buff/debuff 成對且目標一致', () => {
    const pairs: [string, string][] = [
      ['破甲', '佑甲'],
      ['蝕甲', '耀甲'],
      ['恍神', '專注'],
      ['減速', '加速'],
    ];
    for (const [debuff, buff] of pairs) {
      const d = EFFECT_BY_NAME.get(debuff)?.modifier;
      const b = EFFECT_BY_NAME.get(buff)?.modifier;
      expect(d?.target).toBe(b?.target);
      expect(d?.unit).toBe(b?.unit);
      expect(d?.direction).toBe(-1);
      expect(b?.direction).toBe(1);
    }
  });

  it('毒系只有中毒與劇毒', () => {
    const poison = EFFECTS.filter((e) => e.tick?.poison).map((e) => e.name);
    expect(poison.sort()).toEqual(['劇毒', '中毒'].sort());
  });
});

describe('效果抗性', () => {
  it('意志縮短 debuff 持續：滿點 −70%', () => {
    expect(debuffDuration(10, 0)).toBe(10);
    expect(debuffDuration(10, 255)).toBeCloseTo(3, 10);
  });

  it('毒系成功率：滿體質 ×0.7，傷害不受影響', () => {
    expect(poisonApplyChance(1, 0)).toBe(1);
    expect(poisonApplyChance(1, 255)).toBeCloseTo(0.7, 10);
    expect(poisonApplyChance(0.5, 255)).toBeCloseTo(0.35, 10);
  });
});
