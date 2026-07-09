import * as yaml from 'js-yaml';

export function parseYaml<T>(content: string): T {
  return yaml.load(content) as T;
}

export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
  context: string,
): void {
  for (const field of fields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      throw new Error(`${context}: 缺少必填欄位 '${field}'`);
    }
  }
}

const VALID_TAGS = new Set([
  'attack', 'spell',
  'melee', 'ranged', 'sword', 'dagger', 'greatsword', 'bow', 'gun', 'staff',
  'physical', 'fire', 'ice', 'poison', 'magical',
  'weapon', 'armor', 'shield',
  'head', 'neck', 'body', 'ring', 'waist', 'legs', 'feet', 'offhand',
  'boss_source', 'dungeon_only', 'two_handed',
]);

export function validateTags(
  tags: string[],
  context: string,
  allowed: Set<string> = VALID_TAGS,
): void {
  for (const tag of tags) {
    if (!allowed.has(tag)) {
      throw new Error(`${context}: 未知的 tag '${tag}'`);
    }
  }
}
