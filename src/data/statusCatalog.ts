import type { StatusId, StatusKind } from '../core/types.js';

export type StatusEffectType = 'dot' | 'hot' | 'modifier' | 'toggle';
export type ModifierTarget = 'armor' | 'reductionRate' | 'castSpeed' | 'attackSpeed';
export type ModifierUnit = 'flat' | 'percent';

export interface StatusDefinition {
  id: StatusId;
  name: string;
  kind: StatusKind;
  effectType: StatusEffectType;
  maxStacks: number;
  tickInterval: number;
  poison?: boolean;
  modifier?: {
    target: ModifierTarget;
    unit: ModifierUnit;
  };
}

export const STATUSES: Record<StatusId, StatusDefinition> = {
  // 持續跳動型（傷害）
  bleed: { id: 'bleed', name: '出血', kind: 'debuff', effectType: 'dot', maxStacks: 3, tickInterval: 1 },
  bleedPercent: { id: 'bleedPercent', name: '流血', kind: 'debuff', effectType: 'dot', maxStacks: 3, tickInterval: 1 },
  poison: { id: 'poison', name: '中毒', kind: 'debuff', effectType: 'dot', maxStacks: 3, tickInterval: 1, poison: true },
  poisonPercent: { id: 'poisonPercent', name: '劇毒', kind: 'debuff', effectType: 'dot', maxStacks: 3, tickInterval: 1, poison: true },
  burn: { id: 'burn', name: '燃燒', kind: 'debuff', effectType: 'dot', maxStacks: 3, tickInterval: 1 },

  // 持續跳動型（治療）
  regen: { id: 'regen', name: '恢復', kind: 'buff', effectType: 'hot', maxStacks: 0, tickInterval: 1 },
  healing: { id: 'healing', name: '治療', kind: 'buff', effectType: 'hot', maxStacks: 0, tickInterval: 1 },

  // 數值修飾型
  armorBreak: { id: 'armorBreak', name: '破甲', kind: 'debuff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'armor', unit: 'flat' } },
  armorBuff: { id: 'armorBuff', name: '佑甲', kind: 'buff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'armor', unit: 'flat' } },
  reductionBreak: { id: 'reductionBreak', name: '蝕甲', kind: 'debuff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'reductionRate', unit: 'percent' } },
  reductionBuff: { id: 'reductionBuff', name: '耀甲', kind: 'buff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'reductionRate', unit: 'percent' } },
  castSlow: { id: 'castSlow', name: '恍神', kind: 'debuff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'castSpeed', unit: 'percent' } },
  castHaste: { id: 'castHaste', name: '專注', kind: 'buff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'castSpeed', unit: 'percent' } },
  attackSlow: { id: 'attackSlow', name: '減速', kind: 'debuff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'attackSpeed', unit: 'percent' } },
  attackHaste: { id: 'attackHaste', name: '加速', kind: 'buff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'attackSpeed', unit: 'percent' } },
  iceSlow: { id: 'iceSlow', name: '冰緩', kind: 'debuff', effectType: 'modifier', maxStacks: 0, tickInterval: 0, modifier: { target: 'attackSpeed', unit: 'percent' } },

  // 狀態開關型
  freeze: { id: 'freeze', name: '冰凍', kind: 'debuff', effectType: 'toggle', maxStacks: 0, tickInterval: 0 },
  stun: { id: 'stun', name: '暈眩', kind: 'debuff', effectType: 'toggle', maxStacks: 0, tickInterval: 0 },
  silence: { id: 'silence', name: '沉默', kind: 'debuff', effectType: 'toggle', maxStacks: 0, tickInterval: 0 },
};

export function statusById(id: StatusId): StatusDefinition {
  return STATUSES[id];
}
