import type { StatusKind, ToggleBehavior } from '../core/types.js';
import { LOADED_STATUSES } from './effectsLoader.js';

export type StatusEffectType = 'dot' | 'hot' | 'modifier' | 'toggle';

export interface StatusDefinition {
  id: string;
  name: string;
  type: StatusEffectType;
  direction: StatusKind;
  stackLimit: number;
  target?: string;
  unit?: string;
  behavior?: ToggleBehavior;
}

export const STATUSES: Record<string, StatusDefinition> = LOADED_STATUSES;

export function statusById(id: string): StatusDefinition {
  const status = STATUSES[id];
  if (!status) throw new Error(`Unknown status: ${id}`);
  return status;
}
