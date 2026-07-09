export type VictoryConditionKind =
  | 'killAll'
  | 'killCount'
  | 'killTarget'
  | 'survive'
  | 'escort'
  | 'interact';

export interface VictoryCondition {
  kind: VictoryConditionKind;
  requirement: 'required' | 'optional' | 'any-of';
  bonusPoints?: number;
  count?: number;
  targetId?: string;
  seconds?: number;
}

export interface VictoryState {
  killCount: number;
  killedIds: Set<string>;
  aliveEnemyCount: number;
  elapsedSeconds: number;
  escortAlive: Map<string, boolean>;
  interacted: Set<string>;
}

export function createVictoryState(): VictoryState {
  return {
    killCount: 0,
    killedIds: new Set(),
    aliveEnemyCount: 0,
    elapsedSeconds: 0,
    escortAlive: new Map(),
    interacted: new Set(),
  };
}

function isConditionMet(condition: VictoryCondition, state: VictoryState): boolean {
  switch (condition.kind) {
    case 'killAll':
      return state.aliveEnemyCount === 0;
    case 'killCount':
      return state.killCount >= (condition.count ?? 0);
    case 'killTarget':
      return condition.targetId ? state.killedIds.has(condition.targetId) : false;
    case 'survive':
      return state.elapsedSeconds >= (condition.seconds ?? 0);
    case 'escort':
      return condition.targetId ? (state.escortAlive.get(condition.targetId) ?? false) : false;
    case 'interact':
      return condition.targetId ? state.interacted.has(condition.targetId) : false;
  }
}

export interface VictoryResult {
  cleared: boolean;
  bonusPoints: number;
}

export function evaluateVictory(conditions: VictoryCondition[], state: VictoryState): VictoryResult {
  let bonusPoints = 0;

  const required = conditions.filter((c) => c.requirement === 'required');
  const anyOf = conditions.filter((c) => c.requirement === 'any-of');
  const optional = conditions.filter((c) => c.requirement === 'optional');

  const allRequiredMet = required.every((c) => isConditionMet(c, state));
  const anyOfMet = anyOf.length === 0 || anyOf.some((c) => isConditionMet(c, state));

  if (!allRequiredMet || !anyOfMet) {
    return { cleared: false, bonusPoints: 0 };
  }

  for (const c of optional) {
    if (isConditionMet(c, state)) {
      bonusPoints += c.bonusPoints ?? 0;
    }
  }

  return { cleared: true, bonusPoints };
}
