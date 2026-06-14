import type { Attributes, BattleSetup, DifficultyRank, EquipmentLoadout } from './types.js';
import { createEncounterSpawns } from './encounterCatalog.js';
import { DEFAULT_LOADOUT } from './equipmentCatalog.js';

const DEFAULT_PLAYER_ATTRS: Attributes = { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 };

export function createDefaultBattleSetup(
  playerAttrs: Attributes = DEFAULT_PLAYER_ATTRS,
  loadout = DEFAULT_LOADOUT,
): BattleSetup {
  return {
    player: {
      name: '玩家',
      attrs: { ...playerAttrs },
      loadout: { ...loadout },
      position: { x: 400, y: 310 },
      facing: -Math.PI / 2,
    },
    enemies: [
      { enemyId: 'redScout', position: { x: 190, y: 180 }, facing: 0 },
      { enemyId: 'orangeGuard', position: { x: 610, y: 430 }, facing: Math.PI },
      { enemyId: 'purpleShooter', position: { x: 640, y: 150 }, facing: Math.PI },
    ],
  };
}

export function createRandomBattleSetup(params: {
  playerAttrs: Attributes;
  loadout: EquipmentLoadout;
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
      position: { x: 400, y: 310 },
      facing: -Math.PI / 2,
    },
    enemies: encounter.enemies,
    allies: encounter.allies,
  };
}
