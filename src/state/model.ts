import type { Attributes } from '../core/types.js';
import type { GearSlot } from '../data/gear.js';

/**
 * 一條命的所有東西都掛在角色身上：貨幣、道具、技能。
 * 人物死亡不會繼承任何東西給下一輪——那是另一個人生。
 */
export interface CharacterState {
  name: string;
  /** 已含購買累計的六主屬性 */
  attrs: Attributes;
  /** 單一貨幣：升屬性、買裝備道具，活著的一切開銷 */
  currency: number;
  inventory: string[];
  knownSkills: string[];
  equippedWeapon: string | null;
  equippedGear: Partial<Record<GearSlot, string>>;
  skillSlots: string[];
  /** 強迫晉級依據：本人歷史最高層 */
  highestFloor: number;
}

export interface GameState {
  era: number;
  /** 純紀錄，不影響遊戲性 */
  records: { lives: number; bestFloor: number };
  character: CharacterState | null;
}

export const BASE_ATTRS: Attributes = { str: 5, vit: 5, agi: 5, dex: 5, wil: 5, luk: 5 };
export const STARTING_CURRENCY = 200;
export const MAX_SKILL_SLOTS = 4;

export function newGame(): GameState {
  return { era: 1, records: { lives: 0, bestFloor: 0 }, character: null };
}

export function createCharacter(name: string): CharacterState {
  return {
    name,
    attrs: { ...BASE_ATTRS },
    currency: STARTING_CURRENCY,
    inventory: ['iron-sword', 'leather-armor'],
    knownSkills: ['heavy-slash'],
    equippedWeapon: 'iron-sword',
    equippedGear: { 防具: 'leather-armor' },
    skillSlots: ['heavy-slash'],
    highestFloor: 0,
  };
}
