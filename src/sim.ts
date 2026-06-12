/**
 * 平衡模擬工具：四種典型流派打各層敵人，看勝率與戰鬥時長。
 * 用法：pnpm sim
 */
import { simulateBattle } from './core/combat.js';
import { buildPlayerUnit } from './core/character.js';
import { makeEnemy } from './core/dungeon.js';
import { createRng } from './core/rng.js';
import { addAttrs } from './core/attributes.js';
import { BASE_ATTRS, createCharacter, type CharacterState } from './state/model.js';
import type { Attributes } from './core/types.js';

const BATTLES_PER_CELL = 200;
const MAX_FLOOR = 15;

interface BuildSpec {
  name: string;
  /** 屬性點分配比例 */
  ratio: Partial<Attributes>;
  weapon: string;
  gear: { 防具?: string; 副手?: string; 飾品?: string };
  skills: string[];
}

const BUILDS: BuildSpec[] = [
  {
    name: '戰士',
    ratio: { str: 4, vit: 3, agi: 2, dex: 1 },
    weapon: 'greatsword',
    gear: { 防具: 'chainmail', 副手: 'round-shield', 飾品: 'power-ring' },
    skills: ['heavy-slash', 'armor-break', 'rend'],
  },
  {
    name: '槍手',
    ratio: { dex: 4, luk: 2, vit: 2, agi: 1 },
    weapon: 'rifle',
    gear: { 防具: 'leather-armor', 飾品: 'marksman-goggles' },
    skills: ['piercing-shot', 'venom-round', 'concussion-round'],
  },
  {
    name: '法師',
    ratio: { wil: 5, vit: 2, agi: 1 },
    weapon: 'sage-staff',
    gear: { 防具: 'cloth-robe', 飾品: 'meditation-pendant' },
    skills: ['flame-burst', 'fireball', 'ice-bolt', 'heal'],
  },
  {
    name: '魔戰士',
    ratio: { str: 3, wil: 3, vit: 2 },
    weapon: 'iron-sword',
    gear: { 防具: 'chainmail', 飾品: 'life-amulet' },
    skills: ['heavy-slash', 'fireball', 'heal'],
  },
];

/** 假設每層約可換到 2.5 點主屬性（實際走貨幣經濟，這裡取近似值看平衡） */
function buildCharacter(spec: BuildSpec, floor: number): CharacterState {
  const points = Math.round(2.5 * (floor - 1));
  const totalRatio = Object.values(spec.ratio).reduce((a, b) => a + b, 0);
  const bonus: Partial<Attributes> = {};
  for (const [key, r] of Object.entries(spec.ratio)) {
    bonus[key as keyof Attributes] = Math.round((points * r) / totalRatio);
  }
  const character = createCharacter('模擬者');
  character.attrs = addAttrs({ ...BASE_ATTRS }, bonus);
  character.equippedWeapon = spec.weapon;
  character.equippedGear = { ...spec.gear };
  character.skillSlots = spec.skills;
  return character;
}

const rng = createRng(20260612);

const header = ['層數', ...BUILDS.map((b) => b.name.padStart(6))].join(' | ');
console.log(header);
console.log('-'.repeat(header.length + 8));

for (let floor = 1; floor <= MAX_FLOOR; floor++) {
  const cells: string[] = [];
  for (const spec of BUILDS) {
    const unit = buildPlayerUnit(buildCharacter(spec, floor));
    let wins = 0;
    for (let i = 0; i < BATTLES_PER_CELL; i++) {
      const enemy = makeEnemy(floor, rng);
      if (simulateBattle(unit, enemy, rng).winner === 'player') wins++;
    }
    cells.push(`${((wins / BATTLES_PER_CELL) * 100).toFixed(0).padStart(5)}%`);
  }
  console.log([String(floor).padStart(4), ...cells].join(' | '));
}
