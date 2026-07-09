import type { Rank, EnemySpawn, Vec2 } from '../core/types.js';
import type { VictoryCondition } from '../core/victoryConditions.js';
import { parseYaml } from './yamlLoader.js';
import { scaledEnemyAttrs } from './enemyScaling.js';
import { ENEMY_DEFINITIONS } from './enemiesLoader.js';
import { createRng } from '../core/rng.js';
import scenesRaw from './content/scenes.yaml?raw';

interface YamlSceneSpawn {
  archetype: string;
  count: number;
  boss?: boolean;
}

interface YamlScene {
  name: string;
  enemies: YamlSceneSpawn[];
  allies?: YamlSceneSpawn[];
  neutrals?: YamlSceneSpawn[];
  victoryConditions: VictoryCondition[];
  rewardPoints: number;
}

export interface LoadedScene {
  id: string;
  name: string;
  enemies: YamlSceneSpawn[];
  allies: YamlSceneSpawn[];
  neutrals: YamlSceneSpawn[];
  victoryConditions: VictoryCondition[];
  rewardPoints: number;
}

const ENEMY_POSITIONS: Vec2[] = [
  { x: 190, y: 180 },
  { x: 610, y: 430 },
  { x: 640, y: 150 },
  { x: 170, y: 420 },
  { x: 520, y: 105 },
  { x: 290, y: 500 },
];

const ALLY_POSITIONS: Vec2[] = [
  { x: 300, y: 345 },
  { x: 260, y: 280 },
];

const NEUTRAL_POSITIONS: Vec2[] = [
  { x: 420, y: 145 },
  { x: 360, y: 470 },
];

function facingFor(position: Vec2): number {
  return Math.atan2(310 - position.y, 400 - position.x);
}

function spawnName(baseName: string, index: number, total: number): string {
  return total > 1 ? `${baseName} ${index + 1}` : baseName;
}

function archetypeName(archetypeId: string): string {
  return ENEMY_DEFINITIONS[archetypeId]?.name ?? archetypeId;
}

const raw = parseYaml<Record<string, YamlScene>>(scenesRaw);

const SCENES: Record<string, LoadedScene> = {};
for (const [id, entry] of Object.entries(raw)) {
  if (id.startsWith('_')) continue;
  SCENES[id] = {
    id,
    name: entry.name,
    enemies: entry.enemies,
    allies: entry.allies ?? [],
    neutrals: entry.neutrals ?? [],
    victoryConditions: entry.victoryConditions,
    rewardPoints: entry.rewardPoints,
  };
}

export function getScene(sceneId: string): LoadedScene {
  const scene = SCENES[sceneId];
  if (!scene) throw new Error(`Unknown scene: ${sceneId}`);
  return scene;
}

export function getSceneIds(): string[] {
  return Object.keys(SCENES);
}

function spawnGroup(
  members: YamlSceneSpawn[],
  positions: Vec2[],
  rank: Rank,
  rng: () => number,
): EnemySpawn[] {
  const spawns: EnemySpawn[] = [];
  for (const member of members) {
    const name = archetypeName(member.archetype);
    for (let i = 0; i < member.count; i += 1) {
      const position = positions[spawns.length % positions.length];
      spawns.push({
        enemyId: member.archetype,
        name: spawnName(name, i, member.count),
        attrs: scaledEnemyAttrs(ENEMY_DEFINITIONS[member.archetype].attrs, rank, rng),
        position: { ...position },
        facing: facingFor(position),
      });
    }
  }
  return spawns;
}

export function createSceneSpawns(
  sceneId: string,
  rank: Rank,
  seed: number,
): { name: string; enemies: EnemySpawn[]; allies: EnemySpawn[]; neutrals: EnemySpawn[] } {
  const scene = getScene(sceneId);
  const rng = createRng(seed);
  return {
    name: scene.name,
    enemies: spawnGroup(scene.enemies, ENEMY_POSITIONS, rank, rng),
    allies: spawnGroup(scene.allies, ALLY_POSITIONS, rank, rng),
    neutrals: spawnGroup(scene.neutrals, NEUTRAL_POSITIONS, rank, rng),
  };
}
