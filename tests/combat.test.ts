import { describe, expect, it } from 'vitest';
import { computeFinalDamage, simulateBattle } from '../src/core/combat.js';
import { deriveStats, rollSpread } from '../src/core/attributes.js';
import { applyStatus, type StatusInstance } from '../src/core/effects.js';
import { buildPlayerUnit } from '../src/core/character.js';
import { makeEnemy, startingFloor } from '../src/core/dungeon.js';
import { attrPrice } from '../src/game/economy.js';
import { createRng } from '../src/core/rng.js';
import { createCharacter } from '../src/state/model.js';
import { FIST } from '../src/data/weapons.js';
import type { Attributes, Unit } from '../src/core/types.js';

function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { str: 5, vit: 5, agi: 5, dex: 5, wil: 5, luk: 5, ...overrides };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    name: '測試者',
    attrs: attrs(),
    defense: { flat: 0, pct: 0, parryFlat: 0, parryPct: 0 },
    weapon: FIST,
    skills: [],
    damageMult: 1,
    ...overrides,
  };
}

const NO_DEFENSE = { flat: 0, pct: 0, parryFlat: 0, parryPct: 0 };

describe('衍生值', () => {
  it('生命吃體質、精神吃意志', () => {
    const low = deriveStats(attrs());
    const tanky = deriveStats(attrs({ vit: 20 }));
    const sage = deriveStats(attrs({ wil: 20 }));
    expect(tanky.maxHp).toBeGreaterThan(low.maxHp);
    expect(sage.maxMp).toBeGreaterThan(low.maxMp);
    expect(sage.mpRegen).toBeGreaterThan(low.mpRegen);
  });

  it('發揮度：靈巧高，大小傷擲骰偏向高段', () => {
    const lowDex = deriveStats(attrs({ dex: 1 }));
    const highDex = deriveStats(attrs({ dex: 60 }));
    const rngA = createRng(42);
    const rngB = createRng(42);
    let lowSum = 0;
    let highSum = 0;
    for (let i = 0; i < 500; i++) {
      lowSum += rollSpread(rngA, [10, 30], lowDex.spreadExp);
      highSum += rollSpread(rngB, [10, 30], highDex.spreadExp);
    }
    expect(highSum / 500).toBeGreaterThan(lowSum / 500);
  });
});

describe('效果覆蓋（優先度）', () => {
  const derived = deriveStats(attrs({ wil: 0 }));

  it('低優先度無法覆蓋高優先度，同名只存在一份', () => {
    const statuses: StatusInstance[] = [];
    const high = applyStatus(statuses, { statusId: '流血', priority: 230, duration: 6, magnitude: 20 }, 0, derived);
    expect(high.outcome).toBe('applied');
    const low = applyStatus(statuses, { statusId: '流血', priority: 10, duration: 6, magnitude: 3 }, 1, derived);
    expect(low.outcome).toBe('blocked');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].magnitude).toBe(20);
  });

  it('高優先度取代低優先度', () => {
    const statuses: StatusInstance[] = [];
    applyStatus(statuses, { statusId: '流血', priority: 10, duration: 6, magnitude: 3 }, 0, derived);
    const result = applyStatus(statuses, { statusId: '流血', priority: 230, duration: 6, magnitude: 20 }, 1, derived);
    expect(result.outcome).toBe('replaced');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].magnitude).toBe(20);
  });

  it('不同名效果互不相干，可並存', () => {
    const statuses: StatusInstance[] = [];
    applyStatus(statuses, { statusId: '流血', priority: 10, duration: 6, magnitude: 3 }, 0, derived);
    applyStatus(statuses, { statusId: '燃燒', priority: 10, duration: 6, magnitude: 2 }, 0, derived);
    expect(statuses).toHaveLength(2);
  });

  it('意志縮短持續時間；感染另由體質減低強度', () => {
    const ironWill = deriveStats(attrs({ wil: 30 }));
    const statuses: StatusInstance[] = [];
    const bleed = applyStatus(statuses, { statusId: '流血', priority: 10, duration: 10, magnitude: 3 }, 0, ironWill);
    expect(bleed.duration).toBeLessThan(10);

    const tank = deriveStats(attrs({ vit: 30 }));
    const infected: StatusInstance[] = [];
    applyStatus(infected, { statusId: '感染', priority: 10, duration: 10, magnitude: 10 }, 0, tank);
    expect(infected[0].magnitude).toBeLessThan(10);
  });
});

describe('防禦結算：減算與減成', () => {
  it('一般攻擊：先減算後減成', () => {
    const dmg = computeFinalDamage({
      raw: 100,
      defense: { flat: 20, pct: 0.5, parryFlat: 0, parryPct: 0 },
      defFlatReduction: 0,
      parried: false,
      defenderStr: 0,
    });
    expect(dmg).toBe(40); // (100 - 20) × 0.5
  });

  it('穿透不計減算、仍吃減成；真傷全部無視', () => {
    const defense = { flat: 50, pct: 0.5, parryFlat: 0, parryPct: 0 };
    const base = { raw: 100, defense, defFlatReduction: 0, parried: false, defenderStr: 0 };
    expect(computeFinalDamage({ ...base, pierce: true })).toBe(50);
    expect(computeFinalDamage({ ...base, trueDamage: true })).toBe(100);
  });

  it('招架：力量與盾牌提供額外減傷', () => {
    const noParry = computeFinalDamage({
      raw: 100,
      defense: { flat: 10, pct: 0, parryFlat: 18, parryPct: 0.3 },
      defFlatReduction: 0,
      parried: false,
      defenderStr: 20,
    });
    const parried = computeFinalDamage({
      raw: 100,
      defense: { flat: 10, pct: 0, parryFlat: 18, parryPct: 0.3 },
      defFlatReduction: 0,
      parried: true,
      defenderStr: 20,
    });
    expect(parried).toBeLessThan(noParry);
  });

  it('破甲削減減算，傷害最低 1', () => {
    const broken = computeFinalDamage({
      raw: 30,
      defense: { flat: 20, pct: 0, parryFlat: 0, parryPct: 0 },
      defFlatReduction: 15,
      parried: false,
      defenderStr: 0,
    });
    expect(broken).toBe(25);
    const chip = computeFinalDamage({
      raw: 5,
      defense: { flat: 100, pct: 0.8, parryFlat: 0, parryPct: 0 },
      defFlatReduction: 0,
      parried: false,
      defenderStr: 0,
    });
    expect(chip).toBe(1);
  });
});

describe('戰鬥模擬', () => {
  it('壓倒性強者必勝', () => {
    const strong = makeUnit({ attrs: attrs({ str: 40, vit: 30, agi: 20, dex: 20 }) });
    const weak = makeUnit({ name: '弱者', attrs: attrs({ str: 1, vit: 1, agi: 1, dex: 1, wil: 1, luk: 1 }) });
    const result = simulateBattle(strong, weak, createRng(7));
    expect(result.winner).toBe('player');
  });

  it('可指定起始生命（爬塔時血量延續）', () => {
    const player = makeUnit({ attrs: attrs({ vit: 50 }) });
    const enemy = makeUnit({ name: '敵', attrs: attrs({ str: 30 }) });
    const result = simulateBattle(player, enemy, createRng(7), { playerStartHp: 5 });
    expect(result.winner).toBe('enemy');
  });

  it('事件流帶時間戳且遞增', () => {
    const result = simulateBattle(makeUnit(), makeUnit({ name: '敵' }), createRng(7));
    expect(result.events.length).toBeGreaterThan(0);
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].t).toBeGreaterThanOrEqual(result.events[i - 1].t);
    }
  });
});

describe('副本與經濟', () => {
  it('敵人強度隨層數遞增', () => {
    const rng = createRng(7);
    const low = deriveStats(makeEnemy(1, rng).attrs);
    const high = deriveStats(makeEnemy(12, rng).attrs);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
  });

  it('每 5 層是頭目', () => {
    expect(makeEnemy(5, createRng(7)).name).toContain('頭目');
  });

  it('強迫晉級：起始層緊跟最高紀錄', () => {
    expect(startingFloor(0)).toBe(1);
    expect(startingFloor(10)).toBe(8);
  });

  it('屬性買越高越貴', () => {
    expect(attrPrice('str', 5)).toBeLessThan(attrPrice('str', 10));
  });

  it('新角色可以組裝出戰鬥單位', () => {
    const unit = buildPlayerUnit(createCharacter('測試'));
    expect(unit.weapon.id).toBe('iron-sword');
    expect(unit.skills).toHaveLength(1);
    expect(deriveStats(unit.attrs).maxHp).toBeGreaterThan(0);
  });
});
