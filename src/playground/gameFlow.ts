import type { ActionLoadout, Attributes, BattleSetup, Rank, EnemySpawn, EquipmentLoadout } from '../core/types.js';
import { DEFAULT_ACTION_LOADOUT } from '../core/battleSetup.js';
import { enemyById } from '../data/enemyCatalog.js';

export type GameScene = 'landing' | 'novicePlaza' | 'noviceReward' | 'dungeon' | 'rewardPlatform' | 'city';
export type NoviceDifficulty = 1 | 2 | 3;
export type NoviceRewardChoice = 'weapon' | 'armor' | 'points';
export type DungeonStageKind = 'survive' | 'killCount';

export interface NoviceDifficultyOption {
  id: NoviceDifficulty;
  label: string;
  enemyPowerRatio: number;
  rewardMultiplier: number;
}

export interface DungeonStageDefinition {
  id: string;
  title: string;
  kind: DungeonStageKind;
  surviveSeconds?: number;
  requiredKills?: number;
  spawnsByDifficulty: Record<NoviceDifficulty, EnemySpawn[]>;
}

export interface DungeonRunDefinition {
  id: string;
  name: string;
  rank: Rank;
  stages: DungeonStageDefinition[];
}

export interface DungeonRunStats {
  kills: Record<string, number>;
  killRewardPoints: number;
}

export const NOVICE_DIFFICULTIES: NoviceDifficultyOption[] = [
  { id: 1, label: '100% 難度 / 獎勵兩倍', enemyPowerRatio: 1, rewardMultiplier: 2 },
  { id: 2, label: '50% 難度 / 獎勵一倍', enemyPowerRatio: 0.5, rewardMultiplier: 1 },
  { id: 3, label: '25% 難度 / 獎勵減半', enemyPowerRatio: 0.25, rewardMultiplier: 0.5 },
];

export const NOVICE_DUNGEON: DungeonRunDefinition = {
  id: 'grayfang-trial',
  name: '灰牙試煉場',
  rank: 'D',
  stages: [
    {
      id: 'survive-wolf',
      title: '階段一：狼影試煉',
      kind: 'survive',
      surviveSeconds: 30,
      spawnsByDifficulty: {
        1: [{ enemyId: 'eliteWerewolf', name: '菁英狼人', position: { x: 610, y: 300 }, facing: Math.PI }],
        2: [
          { enemyId: 'werewolf', name: '狼人 1', position: { x: 590, y: 265 }, facing: Math.PI },
          { enemyId: 'werewolf', name: '狼人 2', position: { x: 635, y: 335 }, facing: Math.PI },
        ],
        3: [{ enemyId: 'werewolf', name: '狼人', position: { x: 610, y: 300 }, facing: Math.PI }],
      },
    },
    {
      id: 'goblin-camp',
      title: '階段二：哥布林營地',
      kind: 'killCount',
      requiredKills: 0,
      spawnsByDifficulty: {
        1: [
          { enemyId: 'goblinKing', name: '哥布林首領', position: { x: 640, y: 300 }, facing: Math.PI },
          ...lineSpawns('goblin', '哥布林', 20, 455, 190, 42, 44),
        ],
        2: lineSpawns('goblin', '哥布林', 20, 455, 190, 42, 44),
        3: lineSpawns('goblin', '哥布林', 10, 510, 220, 44, 48),
      },
    },
    {
      id: 'vampire-hall',
      title: '階段三：血色大廳',
      kind: 'killCount',
      requiredKills: 0,
      spawnsByDifficulty: {
        1: [
          { enemyId: 'vampireLord', name: '吸血鬼首領', position: { x: 650, y: 300 }, facing: Math.PI },
          { enemyId: 'vampireBride', name: '吸血鬼新娘 1', position: { x: 570, y: 230 }, facing: Math.PI },
          { enemyId: 'vampireBride', name: '吸血鬼新娘 2', position: { x: 565, y: 370 }, facing: Math.PI },
          { enemyId: 'vampireBride', name: '吸血鬼新娘 3', position: { x: 710, y: 300 }, facing: Math.PI },
        ],
        2: [
          { enemyId: 'vampireBride', name: '吸血鬼新娘 1', position: { x: 570, y: 230 }, facing: Math.PI },
          { enemyId: 'vampireBride', name: '吸血鬼新娘 2', position: { x: 565, y: 370 }, facing: Math.PI },
          { enemyId: 'vampireBride', name: '吸血鬼新娘 3', position: { x: 680, y: 300 }, facing: Math.PI },
        ],
        3: [{ enemyId: 'vampireBride', name: '吸血鬼新娘', position: { x: 620, y: 300 }, facing: Math.PI }],
      },
    },
  ],
};

export const KILL_REWARD_POINTS: Record<string, number> = {
  goblin: 10,
  goblinKing: 80,
  werewolf: 40,
  eliteWerewolf: 120,
  vampireBride: 100,
  vampireLord: 300,
};

export function stageRequiredKills(stage: DungeonStageDefinition, difficulty: NoviceDifficulty): number {
  if (stage.id === 'goblin-camp') return difficulty === 3 ? 5 : stage.spawnsByDifficulty[difficulty].length;
  if (stage.id === 'vampire-hall') return difficulty === 1 ? 4 : difficulty === 2 ? 2 : 1;
  return stage.requiredKills ?? stage.spawnsByDifficulty[difficulty].length;
}

export function createDungeonStageSetup(params: {
  playerAttrs: Attributes;
  loadout: EquipmentLoadout;
  actionLoadout?: ActionLoadout;
  difficulty: NoviceDifficulty;
  stage: DungeonStageDefinition;
}): BattleSetup {
  return {
    difficulty: 'D',
    encounterName: `${NOVICE_DUNGEON.name} / ${params.stage.title}`,
    player: {
      name: '玩家',
      attrs: { ...params.playerAttrs },
      loadout: { ...params.loadout },
      actionLoadout: {
        skillSlots: [...(params.actionLoadout ?? DEFAULT_ACTION_LOADOUT).skillSlots],
      },
      position: { x: 220, y: 310 },
      facing: 0,
    },
    enemies: params.stage.spawnsByDifficulty[params.difficulty].map((spawn) => ({
      ...spawn,
      attrs: scaleSpawnAttrs(enemyById(spawn.enemyId).attrs, params.difficulty),
    })),
    obstacles: stageObstacles(params.stage.id),
  };
}

export function emptyRunStats(): DungeonRunStats {
  return { kills: {}, killRewardPoints: 0 };
}

export function killRewardFor(enemyId: string, difficulty: NoviceDifficulty): number {
  const option = NOVICE_DIFFICULTIES.find((item) => item.id === difficulty) ?? NOVICE_DIFFICULTIES[0];
  return Math.round((KILL_REWARD_POINTS[enemyId] ?? 20) * option.rewardMultiplier);
}

function lineSpawns(enemyId: string, label: string, count: number, startX: number, startY: number, stepX: number, stepY: number): EnemySpawn[] {
  return Array.from({ length: count }, (_, index) => ({
    enemyId,
    name: `${label} ${index + 1}`,
    position: {
      x: startX + (index % 5) * stepX,
      y: startY + Math.floor(index / 5) * stepY,
    },
    facing: Math.PI,
  }));
}

function scaleSpawnAttrs(attrs: Attributes | undefined, difficulty: NoviceDifficulty): Attributes | undefined {
  if (!attrs) return undefined;
  const ratio = NOVICE_DIFFICULTIES.find((item) => item.id === difficulty)?.enemyPowerRatio ?? 1;
  return {
    str: Math.max(1, Math.round(attrs.str * ratio)),
    vit: Math.max(1, Math.round(attrs.vit * ratio)),
    agi: Math.max(1, Math.round(attrs.agi * ratio)),
    dex: Math.max(1, Math.round(attrs.dex * ratio)),
    wil: Math.max(1, Math.round(attrs.wil * ratio)),
    luk: Math.max(1, Math.round(attrs.luk * ratio)),
  };
}

function stageObstacles(stageId: string) {
  if (stageId === 'goblin-camp') {
    return [
      { id: 1, position: { x: 390, y: 245 }, width: 70, height: 42 },
      { id: 2, position: { x: 390, y: 375 }, width: 70, height: 42 },
    ];
  }
  if (stageId === 'vampire-hall') {
    return [
      { id: 1, position: { x: 420, y: 180 }, width: 60, height: 120 },
      { id: 2, position: { x: 420, y: 420 }, width: 60, height: 120 },
    ];
  }
  return [{ id: 1, position: { x: 430, y: 300 }, width: 58, height: 120 }];
}
