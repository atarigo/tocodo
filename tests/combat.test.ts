import { describe, expect, it } from 'vitest';
import { computeDamage, simulateBattle, synergyBonus } from '../src/core/combat.js';
import { buildPlayerCombatant, upgradeCost } from '../src/core/character.js';
import { makeEnemy, startingFloor } from '../src/core/dungeon.js';
import { createRng } from '../src/core/rng.js';
import { getSkill } from '../src/data/skills.js';
import { defaultSave, type CharacterData } from '../src/state/save.js';
import type { Combatant } from '../src/core/types.js';

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    name: '測試者',
    stats: { maxHp: 100, atk: 12, def: 4, spd: 8 },
    skills: [],
    synergies: [],
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    name: '測試者',
    unspentPoints: 0,
    allocated: { hp: 0, atk: 0, def: 0, spd: 0 },
    equipped: {},
    skillSlots: ['heavy-slash'],
    ...overrides,
  };
}

describe('傷害公式', () => {
  it('基本：攻擊×倍率−防禦', () => {
    expect(computeDamage(20, 1, 0, 5)).toBe(15);
  });

  it('傷害最低為 1，不會被防禦歸零', () => {
    expect(computeDamage(5, 1, 0, 100)).toBe(1);
  });

  it('標籤協同提高傷害', () => {
    const plain = computeDamage(20, 2, 0, 5);
    const boosted = computeDamage(20, 2, 0.3, 5);
    expect(boosted).toBeGreaterThan(plain);
  });
});

describe('戰鬥模擬', () => {
  it('壓倒性強者必勝', () => {
    const strong = makeCombatant({ stats: { maxHp: 500, atk: 50, def: 20, spd: 20 } });
    const weak = makeCombatant({ name: '弱者', stats: { maxHp: 50, atk: 5, def: 0, spd: 5 } });
    const result = simulateBattle(strong, weak, createRng(1));
    expect(result.winner).toBe('player');
  });

  it('可指定玩家起始生命（爬塔時血量延續）', () => {
    const player = makeCombatant({ stats: { maxHp: 1000, atk: 1, def: 100, spd: 1 } });
    const enemy = makeCombatant({ name: '敵', stats: { maxHp: 1000, atk: 200, def: 0, spd: 10 } });
    const result = simulateBattle(player, enemy, createRng(1), 50);
    expect(result.winner).toBe('enemy');
    expect(result.rounds).toBe(1);
  });

  it('技能依欄位順序優先施放並進入冷卻', () => {
    const player = makeCombatant({
      stats: { maxHp: 1000, atk: 20, def: 0, spd: 99 },
      skills: [getSkill('heavy-slash')],
    });
    const enemy = makeCombatant({ name: '敵', stats: { maxHp: 1000, atk: 1, def: 0, spd: 1 } });
    const result = simulateBattle(player, enemy, createRng(1));
    const skillUses = result.log.filter((line) => line.includes('重斬')).length;
    const basicAttacks = result.log.filter((line) => line.includes('測試者 普通攻擊')).length;
    expect(skillUses).toBeGreaterThan(0);
    expect(basicAttacks).toBeGreaterThan(0);
  });
});

describe('角色組裝', () => {
  it('裝備數值與協同會反映到戰鬥單位', () => {
    const character = makeCharacter({ equipped: { 武器: 'flame-blade' } });
    const combatant = buildPlayerCombatant(character, defaultSave(), { 攻擊聖火: 0, 守護壁壘: 0, 遺產祝福: 1 });
    expect(combatant.stats.atk).toBe(12 + 5);
    expect(synergyBonus(combatant, '火焰')).toBeCloseTo(0.3);
  });

  it('世界效果（偉業）作用於全體玩家數值', () => {
    const character = makeCharacter();
    const normal = buildPlayerCombatant(character, defaultSave(), { 攻擊聖火: 0, 守護壁壘: 0, 遺產祝福: 1 });
    const blessed = buildPlayerCombatant(character, defaultSave(), { 攻擊聖火: 0.5, 守護壁壘: 0, 遺產祝福: 1 });
    expect(blessed.stats.atk).toBe(Math.round(normal.stats.atk * 1.5));
  });

  it('遺產強化對新角色生效', () => {
    const save = defaultSave();
    save.legacyUpgrades.atk = 3;
    const combatant = buildPlayerCombatant(makeCharacter(), save, { 攻擊聖火: 0, 守護壁壘: 0, 遺產祝福: 1 });
    expect(combatant.stats.atk).toBe(12 + 3 * 2);
  });
});

describe('副本規則', () => {
  it('敵人強度隨層數遞增', () => {
    const rng = createRng(7);
    const low = makeEnemy(1, rng);
    const high = makeEnemy(10, rng);
    expect(high.stats.maxHp).toBeGreaterThan(low.stats.maxHp);
    expect(high.stats.atk).toBeGreaterThan(low.stats.atk);
  });

  it('每 5 層出現頭目且帶技能', () => {
    const boss = makeEnemy(5, createRng(7));
    expect(boss.name).toContain('頭目');
    expect(boss.skills.length).toBeGreaterThan(0);
  });

  it('強迫晉級：起始層緊跟最高紀錄', () => {
    expect(startingFloor(0)).toBe(1);
    expect(startingFloor(2)).toBe(1);
    expect(startingFloor(10)).toBe(8);
  });

  it('遺產商店費用遞增', () => {
    expect(upgradeCost(0)).toBeLessThan(upgradeCost(1));
  });
});
