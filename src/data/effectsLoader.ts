import type { StatusKind } from '../core/types.js';
import { parseYaml } from './yamlLoader.js';
import type { StatusDefinition, StatusEffectType } from './statusCatalog.js';
import effectsRaw from './content/effects.yaml?raw';

interface YamlToggleBehavior {
  disableActions?: boolean;
  disableDodge?: boolean;
  disableParry?: boolean;
  disableBlock?: boolean;
  disableSkills?: boolean;
  interruptCast?: boolean;
  breakThreshold?: number;
}

interface YamlEffect {
  name: string;
  type: StatusEffectType;
  direction: StatusKind;
  stackLimit?: number;
  target?: string;
  unit?: string;
  behavior?: YamlToggleBehavior;
}

function loadEffects(): Record<string, StatusDefinition> {
  const raw = parseYaml<Record<string, YamlEffect>>(effectsRaw);
  const result: Record<string, StatusDefinition> = {};

  for (const [id, entry] of Object.entries(raw)) {
    result[id] = {
      id,
      name: entry.name,
      type: entry.type,
      direction: entry.direction,
      stackLimit: entry.stackLimit ?? 0,
      target: entry.target,
      unit: entry.unit,
      behavior: entry.behavior,
    };
  }

  return result;
}

export const LOADED_STATUSES = loadEffects();
