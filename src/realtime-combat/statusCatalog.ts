import type { StatusId, StatusKind, StatusStackRule } from './types.js';

export interface StatusDefinition {
  id: StatusId;
  name: string;
  kind: StatusKind;
  stackRule: StatusStackRule;
  effectType: 'damage' | 'heal';
  tickInterval: number;
}

export const STATUSES: Record<StatusId, StatusDefinition> = {
  bleed: {
    id: 'bleed',
    name: '出血',
    kind: 'debuff',
    stackRule: 'stack',
    effectType: 'damage',
    tickInterval: 1,
  },
  healing: {
    id: 'healing',
    name: '治療術',
    kind: 'buff',
    stackRule: 'refresh',
    effectType: 'heal',
    tickInterval: 1,
  },
};

export function statusById(id: StatusId): StatusDefinition {
  return STATUSES[id];
}
