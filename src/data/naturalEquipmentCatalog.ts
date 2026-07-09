import type { EquipmentDefinition } from '../core/types.js';
import { LOADED_NATURAL_WEAPONS, LOADED_NATURAL_GEAR } from './equipmentLoader.js';

export const NATURAL_WEAPONS = LOADED_NATURAL_WEAPONS;
export const NATURAL_GEAR = LOADED_NATURAL_GEAR;
export const NATURAL_EQUIPMENT: readonly EquipmentDefinition[] = [...NATURAL_WEAPONS, ...NATURAL_GEAR];
