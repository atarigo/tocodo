import type { EnemyDefinition } from '../core/types.js';
import { ENEMY_DEFINITIONS } from './enemiesLoader.js';

export function enemyById(id: string): EnemyDefinition {
  const enemy = ENEMY_DEFINITIONS[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
