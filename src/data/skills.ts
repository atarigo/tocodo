import type { Skill } from '../core/types.js';

export const SKILLS: readonly Skill[] = [
  // 物理
  {
    id: 'heavy-slash',
    name: '重斬',
    tag: '物理',
    cooldown: 2,
    effects: [{ kind: 'damage', multiplier: 1.8 }],
    description: '造成 180% 攻擊傷害。',
  },
  {
    id: 'whirlwind',
    name: '旋風斬',
    tag: '物理',
    cooldown: 3,
    effects: [
      { kind: 'damage', multiplier: 1.5 },
      { kind: 'buff', stat: 'spd', amount: 2, duration: 2 },
    ],
    description: '造成 150% 攻擊傷害，並提升自身速度 2 點，持續 2 回合。',
  },
  {
    id: 'armor-break',
    name: '破甲擊',
    tag: '物理',
    cooldown: 3,
    effects: [
      { kind: 'damage', multiplier: 1.3 },
      { kind: 'debuff', stat: 'def', amount: 4, duration: 3 },
    ],
    description: '造成 130% 攻擊傷害，並降低敵人防禦 4 點，持續 3 回合。',
  },
  // 火焰
  {
    id: 'fireball',
    name: '火球術',
    tag: '火焰',
    cooldown: 2,
    effects: [{ kind: 'damage', multiplier: 2.0 }],
    description: '造成 200% 攻擊傷害。',
  },
  {
    id: 'flame-burst',
    name: '烈焰爆發',
    tag: '火焰',
    cooldown: 4,
    effects: [{ kind: 'damage', multiplier: 3.0 }],
    description: '造成 300% 攻擊傷害。',
  },
  {
    id: 'burning-heart',
    name: '燃燒之心',
    tag: '火焰',
    cooldown: 4,
    effects: [{ kind: 'buff', stat: 'atk', amount: 6, duration: 3 }],
    description: '提升自身攻擊 6 點，持續 3 回合。',
  },
  // 冰霜
  {
    id: 'ice-spike',
    name: '冰錐',
    tag: '冰霜',
    cooldown: 2,
    effects: [
      { kind: 'damage', multiplier: 1.7 },
      { kind: 'debuff', stat: 'spd', amount: 2, duration: 2 },
    ],
    description: '造成 170% 攻擊傷害，並降低敵人速度 2 點，持續 2 回合。',
  },
  {
    id: 'frost-armor',
    name: '寒冰護甲',
    tag: '冰霜',
    cooldown: 4,
    effects: [{ kind: 'buff', stat: 'def', amount: 8, duration: 3 }],
    description: '提升自身防禦 8 點，持續 3 回合。',
  },
  {
    id: 'deep-freeze',
    name: '凍結',
    tag: '冰霜',
    cooldown: 5,
    effects: [
      { kind: 'damage', multiplier: 1.2 },
      { kind: 'debuff', stat: 'spd', amount: 5, duration: 2 },
    ],
    description: '造成 120% 攻擊傷害，並降低敵人速度 5 點，持續 2 回合。',
  },
  // 血祭
  {
    id: 'leech-slash',
    name: '吸血斬',
    tag: '血祭',
    cooldown: 3,
    effects: [
      { kind: 'damage', multiplier: 1.4 },
      { kind: 'heal', percentOfMax: 0.1 },
    ],
    description: '造成 140% 攻擊傷害，並回復 10% 最大生命。',
  },
  {
    id: 'blood-rite',
    name: '血之儀式',
    tag: '血祭',
    cooldown: 4,
    effects: [{ kind: 'heal', percentOfMax: 0.25 }],
    description: '回復 25% 最大生命。',
  },
  {
    id: 'blood-frenzy',
    name: '狂血',
    tag: '血祭',
    cooldown: 4,
    effects: [{ kind: 'buff', stat: 'atk', amount: 8, duration: 3 }],
    description: '提升自身攻擊 8 點，持續 3 回合。',
  },
];

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill {
  const skill = SKILL_BY_ID.get(id);
  if (!skill) throw new Error(`未知技能 id: ${id}`);
  return skill;
}
