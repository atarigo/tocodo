import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Slot } from '../core/types.js';

export interface PointAllocation {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface CharacterData {
  name: string;
  unspentPoints: number;
  allocated: PointAllocation;
  equipped: Partial<Record<Slot, string>>;
  skillSlots: string[];
}

export interface SaveData {
  era: number;
  legacyPoints: number;
  /** 遺產商店各屬性的永久強化等級，跨角色生效 */
  legacyUpgrades: PointAllocation;
  highestFloor: number;
  inventory: string[];
  knownSkills: string[];
  /** null 表示角色已死亡（淘汰），需重新建立 */
  character: CharacterData | null;
}

export const SAVE_PATH = 'save.json';

export function defaultSave(): SaveData {
  return {
    era: 1,
    legacyPoints: 0,
    legacyUpgrades: { hp: 0, atk: 0, def: 0, spd: 0 },
    highestFloor: 0,
    inventory: ['iron-sword', 'leather-armor'],
    knownSkills: ['heavy-slash'],
    character: null,
  };
}

export function loadSave(path: string = SAVE_PATH): SaveData {
  if (!existsSync(path)) return defaultSave();
  return JSON.parse(readFileSync(path, 'utf-8')) as SaveData;
}

export function persistSave(save: SaveData, path: string = SAVE_PATH): void {
  writeFileSync(path, JSON.stringify(save, null, 2));
}
