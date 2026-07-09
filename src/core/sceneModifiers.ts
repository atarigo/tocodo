import type { Modifier } from './modifiers.js';

export interface SceneModifierDef {
  target: string;
  op?: string;
  value: number;
  condition?: { skillHasTag?: string };
  appliesTo?: 'all' | 'player' | 'enemy';
}

export function buildSceneModifiers(defs: SceneModifierDef[], sourceId: string): Modifier[] {
  return defs.map((def) => ({
    source: sourceId,
    target: def.target,
    op: (def.op ?? '+') as Modifier['op'],
    value: def.value,
    condition: def.condition,
    appliesTo: def.appliesTo,
  }));
}
