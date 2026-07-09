import type { Attributes, EnemyDefinition, EquipmentLoadout, EquipmentSlot } from '../core/types.js';
import { parseYaml } from './yamlLoader.js';
import { LOADED_WEAPONS, LOADED_GEAR, LOADED_NATURAL_WEAPONS, LOADED_NATURAL_GEAR } from './equipmentLoader.js';
import enemiesRaw from './content/enemies.yaml?raw';

interface YamlArchetype {
  name: string;
  bossName?: string;
  tags: string[];
  multiplier: number;
  weights: Attributes;
  equipment?: Partial<Record<EquipmentSlot, string>>;
  skills: string[];
  speed: number;
  alertRange: number;
  leashRange: number;
  preferredRange?: number;
  radius: number;
  color: number;
}

interface YamlEnemiesFile {
  archetypes: Record<string, YamlArchetype>;
}

const data = parseYaml<YamlEnemiesFile>(enemiesRaw);

const allEquip = [...LOADED_WEAPONS, ...LOADED_GEAR, ...LOADED_NATURAL_WEAPONS, ...LOADED_NATURAL_GEAR];
const equipMap = new Map(allEquip.map((e) => [e.id, e]));

function defenseFromLoadout(loadout: EquipmentLoadout) {
  const defense = { armor: 0, reductionRate: 0, parryRate: 0, blockRate: 0 };
  for (const id of Object.values(loadout)) {
    if (!id) continue;
    const item = equipMap.get(id);
    if (!item) throw new Error(`Unknown equipment in enemy loadout: ${id}`);
    if ('damage' in item) {
      defense.parryRate += item.parryRate;
      defense.blockRate += item.blockRate ?? 0;
    } else {
      defense.armor += item.armor;
      defense.reductionRate += item.reductionRate;
      defense.parryRate += item.parryRate;
      defense.blockRate += item.blockRate;
    }
  }
  return defense;
}

const BASE_BUDGET = 50;

function baseAttrs(weights: Attributes, multiplier: number): Attributes {
  const budget = BASE_BUDGET * multiplier;
  return {
    str: Math.max(1, Math.round(budget * weights.str)),
    vit: Math.max(1, Math.round(budget * weights.vit)),
    agi: Math.max(1, Math.round(budget * weights.agi)),
    dex: Math.max(1, Math.round(budget * weights.dex)),
    wil: Math.max(1, Math.round(budget * weights.wil)),
    luk: Math.max(1, Math.round(budget * weights.luk)),
  };
}

const enemyDefinitions: Record<string, EnemyDefinition> = {};

for (const [id, archetype] of Object.entries(data.archetypes)) {
  const eq = archetype.equipment ?? {};
  const loadout: EquipmentLoadout = {
    head: eq.head ?? null,
    neck: eq.neck ?? null,
    body: eq.body ?? null,
    mainHand: eq.mainHand ?? null,
    offHand: eq.offHand ?? null,
    ring1: eq.ring1 ?? null,
    ring2: eq.ring2 ?? null,
    waist: eq.waist ?? null,
    legs: eq.legs ?? null,
    feet: eq.feet ?? null,
  };
  const defense = defenseFromLoadout(loadout);

  enemyDefinitions[id] = {
    id,
    name: archetype.name,
    kind: archetype.tags.includes('ranged') ? 'rangedEnemy' : 'meleeEnemy',
    attrs: baseAttrs(archetype.weights, archetype.multiplier),
    radius: archetype.radius,
    color: archetype.color,
    speed: archetype.speed,
    preferredRange: archetype.preferredRange,
    alertRange: archetype.alertRange,
    leashRange: archetype.leashRange,
    skills: archetype.skills,
    armor: defense.armor,
    reductionRate: defense.reductionRate,
    parryRate: defense.parryRate,
    blockRate: defense.blockRate,
    loadout,
  };
}

export const ENEMY_DEFINITIONS: Readonly<Record<string, EnemyDefinition>> = enemyDefinitions;
