import type { Modifier } from './modifiers.js';
import type { SceneModifierDef } from './sceneModifiers.js';
import { buildSceneModifiers } from './sceneModifiers.js';

export interface BossPhaseEffect {
  effect: string;
  rank: string;
  duration: number;
  amount: number;
}

export interface BossPhaseDef {
  name: string;
  when: { hp_above?: number; hp_at_or_below?: number };
  modifiers?: SceneModifierDef[];
  skills?: string[];
  onPhaseEnter?: BossPhaseEffect[];
}

export interface BossPhaseState {
  currentPhase: string | null;
  phases: BossPhaseDef[];
  activeModifiers: Modifier[];
}

export function createBossPhaseState(phases: BossPhaseDef[]): BossPhaseState {
  return { currentPhase: null, phases, activeModifiers: [] };
}

export interface PhaseTransition {
  from: string | null;
  to: string;
  newModifiers: Modifier[];
  newSkills?: string[];
  onEnterEffects?: BossPhaseEffect[];
}

export function checkPhaseTransition(
  state: BossPhaseState,
  hpRatio: number,
  bossId: string,
): PhaseTransition | null {
  for (const phase of state.phases) {
    if (phase.when.hp_above !== undefined && hpRatio <= phase.when.hp_above) continue;
    if (phase.when.hp_at_or_below !== undefined && hpRatio > phase.when.hp_at_or_below) continue;

    if (state.currentPhase === phase.name) return null;

    const newModifiers = buildSceneModifiers(phase.modifiers ?? [], `boss:${bossId}:${phase.name}`);

    return {
      from: state.currentPhase,
      to: phase.name,
      newModifiers,
      newSkills: phase.skills,
      onEnterEffects: phase.onPhaseEnter,
    };
  }
  return null;
}

export function applyPhaseTransition(state: BossPhaseState, transition: PhaseTransition): void {
  state.currentPhase = transition.to;
  state.activeModifiers = transition.newModifiers;
}
