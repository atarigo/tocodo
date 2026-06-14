import type { ActionLoadout, ArenaObstacle, Attributes, BattleSetup, DifficultyRank, EquipmentLoadout } from './types.js';
import { createEncounterSpawns } from './encounterCatalog.js';
import { DEFAULT_LOADOUT } from './equipmentCatalog.js';
import { createRng } from './rng.js';

const DEFAULT_PLAYER_ATTRS: Attributes = { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 };
export const DEFAULT_ACTION_LOADOUT: ActionLoadout = {
  skillSlots: ['heal', null, null, null, null],
  itemSlots: ['smallHealthPotion', null],
};

export function createDefaultBattleSetup(
  playerAttrs: Attributes = DEFAULT_PLAYER_ATTRS,
  loadout = DEFAULT_LOADOUT,
  actionLoadout = DEFAULT_ACTION_LOADOUT,
): BattleSetup {
  return {
    player: {
      name: '玩家',
      attrs: { ...playerAttrs },
      loadout: { ...loadout },
      actionLoadout: cloneActionLoadout(actionLoadout),
      position: { x: 400, y: 310 },
      facing: -Math.PI / 2,
    },
    enemies: [
      { enemyId: 'redScout', position: { x: 190, y: 180 }, facing: 0 },
      { enemyId: 'orangeGuard', position: { x: 610, y: 430 }, facing: Math.PI },
      { enemyId: 'purpleShooter', position: { x: 640, y: 150 }, facing: Math.PI },
    ],
    obstacles: [],
  };
}

export function createRandomBattleSetup(params: {
  playerAttrs: Attributes;
  loadout: EquipmentLoadout;
  actionLoadout: ActionLoadout;
  difficulty: DifficultyRank;
  seed: number;
}): BattleSetup {
  const encounter = createEncounterSpawns(params.difficulty, params.seed);
  return {
    difficulty: params.difficulty,
    encounterName: encounter.name,
    player: {
      name: '玩家',
      attrs: { ...params.playerAttrs },
      loadout: { ...params.loadout },
      actionLoadout: cloneActionLoadout(params.actionLoadout),
      position: { x: 400, y: 310 },
      facing: -Math.PI / 2,
    },
    enemies: encounter.enemies,
    allies: encounter.allies,
    neutrals: encounter.neutrals,
    obstacles: createRandomObstacles(params.seed + 101),
  };
}

function cloneActionLoadout(loadout: ActionLoadout): ActionLoadout {
  return {
    skillSlots: [...loadout.skillSlots],
    itemSlots: [...loadout.itemSlots],
  };
}

function createRandomObstacles(seed: number): ArenaObstacle[] {
  const rng = createRng(seed);
  const count = 1 + Math.floor(rng() * 5);
  const obstacles: ArenaObstacle[] = [];
  const protectedPoints = [
    { x: 400, y: 310, radius: 72 },
    { x: 190, y: 180, radius: 50 },
    { x: 610, y: 430, radius: 50 },
    { x: 640, y: 150, radius: 50 },
    { x: 170, y: 420, radius: 50 },
    { x: 520, y: 105, radius: 50 },
    { x: 290, y: 500, radius: 50 },
    { x: 300, y: 345, radius: 50 },
  ];
  for (let i = 0; i < count; i += 1) {
    let obstacle: ArenaObstacle | null = null;
    for (let attempt = 0; attempt < 20 && !obstacle; attempt += 1) {
      const candidate = {
        id: i + 1,
        position: {
          x: 120 + rng() * 560,
          y: 100 + rng() * 400,
        },
        width: 54 + Math.round(rng() * 80),
        height: 34 + Math.round(rng() * 72),
      };
      const overlapsProtectedPoint = protectedPoints.some((point) => rectOverlapsCircle(candidate, point));
      const overlapsObstacle = obstacles.some((existing) => rectsOverlap(candidate, existing, 18));
      if (!overlapsProtectedPoint && !overlapsObstacle) obstacle = candidate;
    }
    if (obstacle) obstacles.push(obstacle);
  }
  if (obstacles.length === 0) {
    obstacles.push({ id: 1, position: { x: 720, y: 300 }, width: 56, height: 120 });
  }
  return obstacles;
}

function rectOverlapsCircle(rect: ArenaObstacle, circle: { x: number; y: number; radius: number }): boolean {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const closestX = Math.max(rect.position.x - halfWidth, Math.min(circle.x, rect.position.x + halfWidth));
  const closestY = Math.max(rect.position.y - halfHeight, Math.min(circle.y, rect.position.y + halfHeight));
  return Math.hypot(circle.x - closestX, circle.y - closestY) <= circle.radius;
}

function rectsOverlap(a: ArenaObstacle, b: ArenaObstacle, padding: number): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < a.width / 2 + b.width / 2 + padding &&
    Math.abs(a.position.y - b.position.y) < a.height / 2 + b.height / 2 + padding
  );
}
