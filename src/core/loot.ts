import type { Rank } from './types.js';
import { GEAR } from '../data/gear.js';
import { SKILLS } from '../data/skills.js';
import { WEAPONS } from '../data/weapons.js';
import { floorReward } from '../game/economy.js';
import { isBossFloor } from './dungeon.js';
import { pick, type Rng } from './rng.js';
import type { CharacterState } from '../state/model.js';

const ITEM_DROP_RATE = 0.25;
const SKILL_DROP_RATE = 0.15;

/** 掉落階級隨層數上移 */
function rollRank(floor: number, rng: Rng): Rank {
  const weights: [Rank, number][] = [
    ['D', Math.max(0.5, 8 - floor * 0.5)],
    ['C', floor >= 3 ? 3 + floor * 0.3 : 0.5],
    ['B', floor >= 7 ? floor - 6 : 0],
    ['A', floor >= 12 ? (floor - 11) * 0.7 : 0],
    ['S', floor >= 18 ? 0.5 : 0],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [rank, w] of weights) {
    roll -= w;
    if (roll <= 0) return rank;
  }
  return 'D';
}

/** 結算單層獎勵：貨幣與掉落直接寫入角色，回傳給介面顯示的訊息 */
export function rollFloorDrops(floor: number, character: CharacterState, rng: Rng): string[] {
  const messages: string[] = [];
  const boss = isBossFloor(floor);

  const reward = floorReward(floor, boss);
  character.currency += reward;
  messages.push(`獲得 ${reward} 貨幣。`);

  if (boss || rng() < ITEM_DROP_RATE) {
    const rank = rollRank(floor, rng);
    const pool = [...WEAPONS, ...GEAR].filter(
      (item) => !character.inventory.includes(item.id) && item.rank === rank,
    );
    const fallback = [...WEAPONS, ...GEAR].filter((item) => !character.inventory.includes(item.id));
    const candidates = pool.length > 0 ? pool : fallback;
    if (candidates.length > 0) {
      const item = pick(rng, candidates);
      character.inventory.push(item.id);
      messages.push(`獲得【${item.name}】（${item.rank} 級）！`);
    }
  }

  if (boss || rng() < SKILL_DROP_RATE) {
    const rank = rollRank(floor, rng);
    const pool = SKILLS.filter((s) => !character.knownSkills.includes(s.id) && s.rank === rank);
    const fallback = SKILLS.filter((s) => !character.knownSkills.includes(s.id));
    const candidates = pool.length > 0 ? pool : fallback;
    if (candidates.length > 0) {
      const skill = pick(rng, candidates);
      character.knownSkills.push(skill.id);
      messages.push(`習得技能【${skill.name}】（${skill.rank} 級）！`);
    }
  }

  return messages;
}
