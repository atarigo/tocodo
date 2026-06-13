import { describe, expect, it } from 'vitest';
import { simulateBattle } from '../src/core/combat.js';
import { buildPlayerUnit } from '../src/core/character.js';
import { maxHp, maxMp } from '../src/core/formulas.js';
import { makeEnemy, startingFloor } from '../src/core/dungeon.js';
import { attrUpgradeCost } from '../src/game/economy.js';
import { createRng } from '../src/core/rng.js';
import { createCharacter } from '../src/state/model.js';
import { getSkill } from '../src/data/skills.js';
import { getWeapon } from '../src/data/weapons.js';
import type { Attributes, Unit } from '../src/core/types.js';

function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10, ...overrides };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    name: '測試者',
    attrs: attrs(),
    weapon: getWeapon('iron-sword'),
    parryRate: 0.1,
    blockRate: 0,
    armor: 0,
    reductionRate: 0,
    crushRate: 0,
    damageBonus: 1,
    skills: [],
    ...overrides,
  };
}

describe('角色組裝', () => {
  it('新角色：鐵劍＋皮甲，生命＝體質×10、精神＝意志×5', () => {
    const unit = buildPlayerUnit(createCharacter('測試'));
    expect(unit.weapon?.id).toBe('iron-sword');
    expect(unit.parryRate).toBeCloseTo(0.1, 10);
    expect(unit.armor).toBe(6); // 皮甲
    expect(maxHp(unit.attrs.vit)).toBe(100); // 起始體質 10
    expect(maxMp(unit.attrs.wil)).toBe(50);
  });
});

describe('戰鬥模擬（新公式）', () => {
  it('壓倒性強者必勝', () => {
    const strong = makeUnit({ attrs: attrs({ str: 120, vit: 80, agi: 60, dex: 60 }) });
    const weak = makeUnit({ name: '弱者', attrs: attrs({ vit: 5 }) });
    const result = simulateBattle(strong, weak, createRng(7));
    expect(result.winner).toBe('player');
  });

  it('空手不是武器：沒武器又沒技能就打不出傷害', () => {
    const unarmed = makeUnit({ weapon: null, parryRate: 0 });
    const armed = makeUnit({ name: '持劍者' });
    const result = simulateBattle(unarmed, armed, createRng(7));
    expect(result.winner).toBe('enemy');
  });

  it('技能附加效果：撕裂造成出血跳傷', () => {
    const slasher = makeUnit({
      attrs: attrs({ str: 60, dex: 80, vit: 60 }),
      skills: [getSkill('rend')],
    });
    const dummy = makeUnit({ name: '木樁', attrs: attrs({ agi: 0, luk: 0, vit: 100 }), parryRate: 0 });
    const result = simulateBattle(slasher, dummy, createRng(7));
    expect(result.events.some((e) => e.text.includes('中【出血】'))).toBe(true);
    expect(result.events.some((e) => e.kind === 'dot' && e.text.includes('出血'))).toBe(true);
  });

  it('未破防：傷害 1、特效不發動', () => {
    const slasher = makeUnit({ attrs: attrs({ dex: 80 }), skills: [getSkill('rend')] });
    const fortress = makeUnit({
      name: '鐵壁',
      attrs: attrs({ agi: 0, luk: 0, vit: 150 }),
      armor: 9999,
      parryRate: 0,
    });
    const result = simulateBattle(slasher, fortress, createRng(7));
    expect(result.events.some((e) => e.flavor === '未破防')).toBe(true);
    expect(result.events.some((e) => e.text.includes('中【出血】'))).toBe(false);
  });

  it('純 debuff 技可宣告未破防仍生效（蝕甲術）', () => {
    const caster = makeUnit({
      weapon: getWeapon('apprentice-staff'),
      attrs: attrs({ wil: 80, dex: 60 }),
      skills: [getSkill('corrode-armor')],
    });
    const fortress = makeUnit({
      name: '鐵壁',
      attrs: attrs({ agi: 0, luk: 0, vit: 150 }),
      armor: 9999,
      parryRate: 0,
    });
    const result = simulateBattle(caster, fortress, createRng(7));
    expect(result.events.some((e) => e.text.includes('中【蝕甲】'))).toBe(true);
  });

  it('事件流時間戳遞增', () => {
    const result = simulateBattle(makeUnit(), makeUnit({ name: '敵' }), createRng(7));
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].t).toBeGreaterThanOrEqual(result.events[i - 1].t);
    }
  });
});

describe('副本與經濟', () => {
  it('敵人強度隨層數遞增', () => {
    const rng = createRng(7);
    const low = makeEnemy(1, rng);
    const high = makeEnemy(12, rng);
    const sum = (a: Attributes) => Object.values(a).reduce((x, y) => x + y, 0);
    expect(sum(high.attrs)).toBeGreaterThan(sum(low.attrs));
  });

  it('每 5 層是頭目且普攻帶碾壓', () => {
    const boss = makeEnemy(5, createRng(7));
    expect(boss.name).toContain('頭目');
    expect(boss.crushRate).toBeCloseTo(0.15, 10);
  });

  it('強迫晉級：起始層緊跟最高紀錄', () => {
    expect(startingFloor(0)).toBe(1);
    expect(startingFloor(10)).toBe(8);
  });

  it('屬性升級費用依區間遞增', () => {
    expect(attrUpgradeCost(10)).toBe(100);
    expect(attrUpgradeCost(60)).toBe(300);
    expect(attrUpgradeCost(210)).toBe(10000);
  });
});
