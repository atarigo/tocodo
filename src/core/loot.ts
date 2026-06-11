import { EQUIPMENT } from '../data/equipment.js';
import { SKILLS } from '../data/skills.js';
import { isBossFloor } from './dungeon.js';
import { pick, type Rng } from './rng.js';
import type { SaveData } from '../state/save.js';

const EQUIP_DROP_RATE = 0.3;
const SKILL_DROP_RATE = 0.2;

/** 結算單層獎勵：掉落直接寫入存檔，回傳給介面層顯示的訊息 */
export function rollFloorDrops(floor: number, save: SaveData, rng: Rng): string[] {
  const messages: string[] = [];
  const boss = isBossFloor(floor);

  if (boss || rng() < EQUIP_DROP_RATE) {
    const candidates = EQUIPMENT.filter((e) => !save.inventory.includes(e.id));
    if (candidates.length > 0) {
      const item = pick(rng, candidates);
      save.inventory.push(item.id);
      messages.push(`獲得裝備【${item.name}】！`);
    }
  }

  if (boss || rng() < SKILL_DROP_RATE) {
    const candidates = SKILLS.filter((s) => !save.knownSkills.includes(s.id));
    if (candidates.length > 0) {
      const skill = pick(rng, candidates);
      save.knownSkills.push(skill.id);
      messages.push(`習得技能【${skill.name}】！`);
    }
  }

  return messages;
}
