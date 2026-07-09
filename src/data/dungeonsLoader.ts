import type { Rank } from '../core/types.js';
import type { VictoryCondition } from '../core/victoryConditions.js';
import type { SceneModifierDef } from '../core/sceneModifiers.js';
import type { BossPhaseDef } from '../core/bossPhases.js';
import { parseYaml } from './yamlLoader.js';

export interface SceneEnemySpawn {
  archetype: string;
  count: number;
  boss?: boolean;
  crushRate?: number;
  phases?: BossPhaseDef[];
}

export interface SceneDefinition {
  id: string;
  title: string;
  enemies: SceneEnemySpawn[];
  sceneModifiers?: SceneModifierDef[];
  victoryConditions: VictoryCondition[];
  rewardPoints: number;
}

export interface DungeonDefinition {
  id: string;
  name: string;
  rank: Rank;
  scenes: SceneDefinition[];
}

interface YamlScene {
  id: string;
  title: string;
  enemies: SceneEnemySpawn[];
  sceneModifiers?: SceneModifierDef[];
  victoryConditions: VictoryCondition[];
  rewardPoints: number;
}

interface YamlDungeon {
  name: string;
  rank: Rank;
  scenes: YamlScene[];
}

export function loadDungeons(yamlContent: string): DungeonDefinition[] {
  const raw = parseYaml<Record<string, YamlDungeon>>(yamlContent);
  const result: DungeonDefinition[] = [];

  for (const [id, entry] of Object.entries(raw)) {
    if (id.startsWith('_')) continue;
    result.push({
      id,
      name: entry.name,
      rank: entry.rank,
      scenes: entry.scenes,
    });
  }

  return result;
}
