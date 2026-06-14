import type { EnemyDefinition } from './types.js';

export const ENEMY_CATALOG: Record<string, EnemyDefinition> = {
  redScout: {
    id: 'redScout',
    name: '赤色斥候',
    kind: 'meleeEnemy',
    attrs: { str: 8, vit: 8, agi: 8, dex: 8, wil: 6, luk: 6 },
    radius: 16,
    color: 0xe0564b,
    speed: 86,
    armor: 0,
    reductionRate: 0,
    parryRate: 0,
    blockRate: 0,
    loadout: {
      mainHand: 'iron-sword',
      offHand: 'wooden-shield',
      head: 'leather-cap',
      body: 'leather-armor',
      legs: 'leather-pants',
      feet: 'leather-boots',
    },
  },
  orangeGuard: {
    id: 'orangeGuard',
    name: '橙色守衛',
    kind: 'meleeEnemy',
    attrs: { str: 11, vit: 12, agi: 6, dex: 8, wil: 8, luk: 5 },
    radius: 16,
    color: 0xe0954b,
    speed: 78,
    armor: 1,
    reductionRate: 0,
    parryRate: 0,
    blockRate: 0,
    loadout: {
      mainHand: 'greatsword',
      offHand: null,
      head: 'iron-helm',
      body: 'iron-armor',
      legs: 'iron-greaves',
      feet: 'iron-boots',
    },
  },
  purpleShooter: {
    id: 'purpleShooter',
    name: '紫色射手',
    kind: 'rangedEnemy',
    attrs: { str: 7, vit: 7, agi: 10, dex: 12, wil: 10, luk: 8 },
    radius: 14,
    color: 0xb04bd9,
    speed: 62,
    preferredRange: 170,
    armor: 0,
    reductionRate: 0,
    parryRate: 0,
    blockRate: 0,
    loadout: {
      mainHand: 'hunting-bow',
      offHand: null,
      head: 'leather-cap',
      body: 'leather-armor',
      legs: 'leather-pants',
      feet: 'leather-boots',
    },
  },
};

export function enemyById(id: string): EnemyDefinition {
  const enemy = ENEMY_CATALOG[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
