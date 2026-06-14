export interface Vec2 {
  x: number;
  y: number;
}

export type CombatantKind = 'player' | 'meleeEnemy' | 'rangedEnemy';

/** 六主屬性：範圍 0〜255、起始 10；沒有預設數值，基本狀態全由屬性或裝備提供 */
export interface Attributes {
  str: number; // 力量：傷害固定值直加
  vit: number; // 體質：生命 ×10、毒系附加成功率折減
  agi: number; // 敏捷：攻速（依武器宣告）、閃避
  dex: number; // 靈巧：命中（壓制閃避）、平衡放大
  wil: number; // 意志：精神 ×5、debuff 縮時
  luk: number; // 幸運：暴擊（攻）、躲避（守）
}

export const ATTR_NAMES: Record<keyof Attributes, string> = {
  str: '力量',
  vit: '體質',
  agi: '敏捷',
  dex: '靈巧',
  wil: '意志',
  luk: '幸運',
};

export interface Combatant {
  id: number;
  kind: CombatantKind;
  name: string;
  attrs: Attributes;
  radius: number;
  color: number;
  position: Vec2;
  facing: number;
  speed: number;
  attackRange: number;
  attackArc: number;
  attackCooldown: number;
  cooldown: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  armor: number;
  reductionRate: number;
  parryRate: number;
  blockRate: number;
  flash: number;
  bodyId: number | null;
}

export interface Projectile {
  id: number;
  ownerId: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
}

export interface Strike {
  id: number;
  position: Vec2;
  angle: number;
  range: number;
  arc: number;
  ttl: number;
  color: number;
  style: 'arc' | 'slash';
}

export interface Impact {
  id: number;
  position: Vec2;
  ttl: number;
}

export interface DamageText {
  id: number;
  position: Vec2;
  text: string;
  ttl: number;
}

export interface CombatLogEntry {
  id: number;
  actorSide: 'player' | 'enemy';
  actorName: string;
  targetName: string;
  action: '普攻';
  damage: number;
  outcome: string;
}

export interface InputState {
  move: Vec2;
  aim: Vec2;
  attacking: boolean;
}

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
