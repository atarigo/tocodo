import type { Attributes, BattleSetup } from './types.js';
import { DEFAULT_WEAPON_ID } from './weaponCatalog.js';

const DEFAULT_PLAYER_ATTRS: Attributes = { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 };

export function createDefaultBattleSetup(
  playerAttrs: Attributes = DEFAULT_PLAYER_ATTRS,
  weaponId = DEFAULT_WEAPON_ID,
): BattleSetup {
  return {
    player: {
      name: '玩家',
      attrs: { ...playerAttrs },
      weaponId,
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
