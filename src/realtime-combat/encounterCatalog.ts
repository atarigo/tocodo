import { createRng, pick } from './rng.js';
import { scaledEnemyAttrs, type EnemyArchetypeId } from './enemyScaling.js';
import type { DifficultyRank, EnemySpawn, Vec2 } from './types.js';

interface EncounterMember {
  enemyId: EnemyArchetypeId;
  count: number;
  side?: 'enemy' | 'ally' | 'neutral';
}

interface EncounterDefinition {
  id: string;
  name: string;
  members: EncounterMember[];
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

export const ENCOUNTERS: readonly EncounterDefinition[] = [
  {
    id: 'elite-werewolf',
    name: '菁英狼人',
    members: [{ enemyId: 'eliteWerewolf', count: 1 }],
  },
  {
    id: 'vampire-brides',
    name: '吸血鬼新娘三人組',
    members: [{ enemyId: 'vampireBride', count: 3 }],
  },
  {
    id: 'goblin-pack',
    name: '哥布林群與哥布林王',
    members: [
      { enemyId: 'goblin', count: 5 },
      { enemyId: 'goblinKing', count: 1 },
    ],
  },
  {
    id: 'goblin-raid',
    name: '哥布林襲擊路人',
    members: [
      { enemyId: 'goblin', count: 3 },
      { enemyId: 'civilian', count: 2, side: 'neutral' },
    ],
  },
  {
    id: 'vampire-lord',
    name: '吸血鬼領主',
    members: [
      { enemyId: 'vampireLord', count: 1 },
      { enemyId: 'vampireBride', count: 2 },
      { enemyId: 'vampireHunter', count: 1, side: 'ally' },
    ],
  },
  {
    id: 'werewolf-pack',
    name: '狼人三人組',
    members: [{ enemyId: 'werewolf', count: 3 }],
  },
  {
    id: 'werewolf-leader',
    name: '狼人首領',
    members: [{ enemyId: 'werewolfLeader', count: 1 }],
  },
];

function spawnName(baseName: string, index: number, total: number): string {
  return total > 1 ? `${baseName} ${index + 1}` : baseName;
}

function facingFor(position: Vec2): number {
  return Math.atan2(310 - position.y, 400 - position.x);
}

export function createEncounterSpawns(rank: DifficultyRank, seed: number): { name: string; enemies: EnemySpawn[]; allies: EnemySpawn[]; neutrals: EnemySpawn[] } {
  const rng = createRng(seed);
  const encounter = pick(rng, ENCOUNTERS);
  const enemies: EnemySpawn[] = [];
  const allies: EnemySpawn[] = [];
  const neutrals: EnemySpawn[] = [];

  for (const member of encounter.members) {
    for (let i = 0; i < member.count; i += 1) {
      const list = member.side === 'ally' ? allies : member.side === 'neutral' ? neutrals : enemies;
      const positions = member.side === 'ally' ? ALLY_POSITIONS : member.side === 'neutral' ? NEUTRAL_POSITIONS : ENEMY_POSITIONS;
      const position = positions[list.length % positions.length];
      list.push({
        enemyId: member.enemyId,
        name: spawnName(displayName(member.enemyId), i, member.count),
        attrs: scaledEnemyAttrs(member.enemyId, rank, rng),
        position: { ...position },
        facing: facingFor(position),
      });
    }
  }

  return { name: encounter.name, enemies, allies, neutrals };
}

function displayName(enemyId: EnemyArchetypeId): string {
  switch (enemyId) {
    case 'goblin':
      return '哥布林';
    case 'goblinKing':
      return '哥布林王';
    case 'werewolf':
      return '狼人';
    case 'eliteWerewolf':
      return '菁英狼人';
    case 'werewolfLeader':
      return '狼人首領';
    case 'vampireBride':
      return '吸血鬼新娘';
    case 'vampireLord':
      return '吸血鬼領主';
    case 'civilian':
      return '路人 NPC';
    case 'vampireHunter':
      return '吸血鬼獵人';
  }
}
