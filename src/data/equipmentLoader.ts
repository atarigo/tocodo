import type { AttrModifier, AttackMode, Attributes, EquipmentSlot, GearDefinition, Rank, WeaponDefinition } from '../core/types.js';
import { parseYaml } from './yamlLoader.js';
import weaponsRaw from './content/weapons.yaml?raw';
import armorRaw from './content/armor.yaml?raw';
import naturalRaw from './content/natural-equipment.yaml?raw';

interface ProvidesEntry {
  target: string;
  op?: string;
  value: number;
}

interface YamlItem {
  name: string;
  rank: Rank;
  tags: string[];
  provides?: ProvidesEntry[];
  price?: number;
}

function pval(provides: ProvidesEntry[] | undefined, target: string): number {
  return provides?.find((p) => p.target === target)?.value ?? 0;
}

function pfind(provides: ProvidesEntry[] | undefined, target: string): ProvidesEntry | undefined {
  return provides?.find((p) => p.target === target);
}

function weaponSlot(id: string): 'mainHand' | 'offHand' {
  if (id.startsWith('offhand-') || id === 'revolver' || id.endsWith('-off')) return 'offHand';
  return 'mainHand';
}

function weaponDefaults(tags: string[]): { range: number; arc: number; attackMode: AttackMode } {
  if (tags.includes('gun')) return { range: 220, arc: 0.3927, attackMode: 'projectile' };
  if (tags.includes('bow')) return { range: 245, arc: 0.6283, attackMode: 'projectile' };
  if (tags.includes('greatsword')) return { range: 118, arc: 2.0071, attackMode: 'melee' };
  if (tags.includes('dagger')) return { range: 58, arc: 1.2217, attackMode: 'melee' };
  if (tags.includes('staff')) return { range: 80, arc: 1.5708, attackMode: 'melee' };
  return { range: 88, arc: 1.5708, attackMode: 'melee' };
}

function gearSlot(tags: string[]): Exclude<EquipmentSlot, 'mainHand'> {
  if (tags.includes('offhand') || tags.includes('shield')) return 'offHand';
  if (tags.includes('head')) return 'head';
  if (tags.includes('neck')) return 'neck';
  if (tags.includes('ring')) return 'ring1';
  if (tags.includes('waist')) return 'waist';
  if (tags.includes('legs')) return 'legs';
  if (tags.includes('feet')) return 'feet';
  return 'body';
}

function toWeapon(id: string, e: YamlItem): WeaponDefinition {
  const p = e.provides;
  const d = weaponDefaults(e.tags);
  return {
    id,
    name: e.name,
    rank: e.rank,
    price: e.price,
    tags: e.tags,
    slot: weaponSlot(id),
    twoHanded: e.tags.includes('two_handed'),
    attackMode: d.attackMode,
    damage: [pval(p, 'damage.base.min'), pval(p, 'damage.base.max')],
    balance: pval(p, 'damage.balance'),
    interval: pval(p, 'attack.interval'),
    range: d.range,
    arc: d.arc,
    parryRate: pval(p, 'attackTable.parry'),
    castTimeMult: pfind(p, 'cast.time')?.value,
    mpCostMult: pfind(p, 'skill.mpCost')?.value,
  };
}

function extractAttrModifiers(provides: ProvidesEntry[] | undefined): AttrModifier[] | undefined {
  if (!provides) return undefined;
  const mods: AttrModifier[] = [];
  for (const p of provides) {
    if (!p.target.startsWith('attribute.')) continue;
    const attr = p.target.slice('attribute.'.length) as keyof Attributes;
    mods.push({ attr, value: p.value });
  }
  return mods.length > 0 ? mods : undefined;
}

function toGear(id: string, e: YamlItem): GearDefinition {
  const p = e.provides;
  return {
    id,
    name: e.name,
    rank: e.rank,
    price: e.price,
    slot: gearSlot(e.tags),
    armor: pval(p, 'defense.armor'),
    reductionRate: pval(p, 'defense.reductionRate'),
    parryRate: 0,
    blockRate: pval(p, 'attackTable.block'),
    attrModifiers: extractAttrModifiers(p),
  };
}

function loadFile(raw: string): { weapons: WeaponDefinition[]; gear: GearDefinition[] } {
  const data = parseYaml<Record<string, YamlItem>>(raw);
  const weapons: WeaponDefinition[] = [];
  const gear: GearDefinition[] = [];
  for (const [id, item] of Object.entries(data)) {
    if (item.tags.includes('weapon')) {
      weapons.push(toWeapon(id, item));
    } else {
      gear.push(toGear(id, item));
    }
  }
  return { weapons, gear };
}

const pw = loadFile(weaponsRaw);
const pa = loadFile(armorRaw);
const natural = loadFile(naturalRaw);

export const LOADED_WEAPONS: readonly WeaponDefinition[] = pw.weapons;
export const LOADED_GEAR: readonly GearDefinition[] = pa.gear;
export const LOADED_NATURAL_WEAPONS: readonly WeaponDefinition[] = natural.weapons;
export const LOADED_NATURAL_GEAR: readonly GearDefinition[] = natural.gear;
