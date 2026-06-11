/**
 * 平衡模擬工具：用「典型成長曲線」的角色打各層敵人，看勝率與回合數。
 * 用法：pnpm sim
 */
import { simulateBattle } from './core/combat.js';
import { buildPlayerCombatant } from './core/character.js';
import { makeEnemy } from './core/dungeon.js';
import { createRng } from './core/rng.js';
import { defaultSave, type CharacterData } from './state/save.js';

const BATTLES_PER_FLOOR = 300;
const MAX_FLOOR = 15;

function typicalCharacter(floor: number): CharacterData {
  const points = Math.max(0, (floor - 1) * 2);
  const atk = Math.round(points * 0.5);
  const hp = Math.round(points * 0.25);
  const def = points - atk - hp;

  if (floor < 4) {
    return {
      name: '模擬者',
      unspentPoints: 0,
      allocated: { hp, atk, def, spd: 0 },
      equipped: { 武器: 'iron-sword', 防具: 'leather-armor' },
      skillSlots: ['heavy-slash'],
    };
  }
  if (floor < 8) {
    return {
      name: '模擬者',
      unspentPoints: 0,
      allocated: { hp, atk, def, spd: 0 },
      equipped: { 武器: 'flame-blade', 防具: 'chainmail', 飾品: 'power-ring' },
      skillSlots: ['fireball', 'heavy-slash'],
    };
  }
  return {
    name: '模擬者',
    unspentPoints: 0,
    allocated: { hp, atk, def, spd: 0 },
    equipped: { 武器: 'flame-blade', 防具: 'chainmail', 飾品: 'life-amulet' },
    skillSlots: ['flame-burst', 'fireball', 'heavy-slash', 'burning-heart'],
  };
}

const rng = createRng(20260612);
const save = defaultSave();

console.log('層數 | 勝率   | 平均回合 | 勝時平均剩餘生命%');
console.log('-----|--------|----------|------------------');
for (let floor = 1; floor <= MAX_FLOOR; floor++) {
  const character = typicalCharacter(floor);
  const player = buildPlayerCombatant(character, save);
  let wins = 0;
  let totalRounds = 0;
  let totalHpLeftRate = 0;
  for (let i = 0; i < BATTLES_PER_FLOOR; i++) {
    const enemy = makeEnemy(floor, rng);
    const result = simulateBattle(player, enemy, rng);
    totalRounds += result.rounds;
    if (result.winner === 'player') {
      wins++;
      totalHpLeftRate += result.playerHpLeft / player.stats.maxHp;
    }
  }
  const winRate = ((wins / BATTLES_PER_FLOOR) * 100).toFixed(1).padStart(5);
  const avgRounds = (totalRounds / BATTLES_PER_FLOOR).toFixed(1).padStart(8);
  const avgHpLeft = wins > 0 ? ((totalHpLeftRate / wins) * 100).toFixed(0) : '-';
  console.log(`${String(floor).padStart(4)} | ${winRate}% | ${avgRounds} | ${String(avgHpLeft).padStart(16)}%`);
}
