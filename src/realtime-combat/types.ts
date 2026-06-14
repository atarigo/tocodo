export interface Vec2 {
  x: number;
  y: number;
}

export type CombatantKind = 'player' | 'meleeEnemy' | 'rangedEnemy';

export interface Combatant {
  id: number;
  kind: CombatantKind;
  radius: number;
  color: number;
  position: Vec2;
  facing: number;
  speed: number;
  attackRange: number;
  attackArc: number;
  attackCooldown: number;
  cooldown: number;
  flash: number;
  bodyId: number | null;
}

export interface Projectile {
  id: number;
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

export interface InputState {
  move: Vec2;
  aim: Vec2;
  attacking: boolean;
}

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
