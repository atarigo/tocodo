import Matter from 'matter-js';
import type { Combatant, Impact, InputState, Projectile, Strike, Vec2 } from './types.js';
import { ARENA_HEIGHT, ARENA_WIDTH } from './types.js';

const WALL_THICKNESS = 64;
const PLAYER_ID = 1;
const MATTER_TICKS_PER_SECOND = 60;

function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function angleDelta(a: number, b: number): number {
  return Math.abs(((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
}

function makeCombatant(params: Omit<Combatant, 'cooldown' | 'flash' | 'bodyId'>): Combatant {
  return { ...params, cooldown: 0, flash: 0, bodyId: null };
}

export class RealtimeCombatEngine {
  readonly player: Combatant;
  readonly enemies: Combatant[];
  readonly projectiles: Projectile[] = [];
  readonly strikes: Strike[] = [];
  readonly impacts: Impact[] = [];

  private readonly matter = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  private readonly bodies = new Map<number, Matter.Body>();
  private nextEffectId = 1;
  private nextProjectileId = 1;

  constructor() {
    this.player = makeCombatant({
      id: PLAYER_ID,
      kind: 'player',
      radius: 17,
      color: 0x5b8def,
      position: { x: 400, y: 310 },
      facing: -Math.PI / 2,
      speed: 230,
      attackRange: 88,
      attackArc: Math.PI / 2,
      attackCooldown: 0.42,
    });

    this.enemies = [
      makeCombatant({
        id: 2,
        kind: 'meleeEnemy',
        radius: 16,
        color: 0xe0564b,
        position: { x: 190, y: 180 },
        facing: 0,
        speed: 86,
        attackRange: 70,
        attackArc: Math.PI / 2,
        attackCooldown: 1.05,
      }),
      makeCombatant({
        id: 3,
        kind: 'meleeEnemy',
        radius: 16,
        color: 0xe0954b,
        position: { x: 610, y: 430 },
        facing: Math.PI,
        speed: 78,
        attackRange: 70,
        attackArc: Math.PI / 2,
        attackCooldown: 1.2,
      }),
      makeCombatant({
        id: 4,
        kind: 'rangedEnemy',
        radius: 14,
        color: 0xb04bd9,
        position: { x: 640, y: 150 },
        facing: Math.PI,
        speed: 62,
        attackRange: 245,
        attackArc: Math.PI / 5,
        attackCooldown: 1.65,
      }),
    ];

    this.addWalls();
    this.addBody(this.player);
    for (const enemy of this.enemies) this.addBody(enemy);
  }

  destroy(): void {
    Matter.Engine.clear(this.matter);
    this.bodies.clear();
  }

  step(input: InputState, dt: number): void {
    const safeDt = Math.min(dt, 1 / 30);
    this.tickTimers(safeDt);
    this.updatePlayer(input);
    this.updateEnemies();
    Matter.Engine.update(this.matter, safeDt * 1000);
    this.syncPositions();
    this.tickProjectiles(safeDt);
    this.tickEffects(safeDt);
  }

  private addWalls(): void {
    Matter.Composite.add(this.matter.world, [
      Matter.Bodies.rectangle(ARENA_WIDTH / 2, -WALL_THICKNESS / 2, ARENA_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true }),
      Matter.Bodies.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT + WALL_THICKNESS / 2, ARENA_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true }),
      Matter.Bodies.rectangle(-WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT + WALL_THICKNESS * 2, { isStatic: true }),
      Matter.Bodies.rectangle(ARENA_WIDTH + WALL_THICKNESS / 2, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT + WALL_THICKNESS * 2, { isStatic: true }),
    ]);
  }

  private addBody(combatant: Combatant): void {
    const body = Matter.Bodies.circle(combatant.position.x, combatant.position.y, combatant.radius, {
      frictionAir: 0.2,
      restitution: 0.35,
      mass: combatant.kind === 'player' ? 1.2 : 1,
    });
    Matter.Composite.add(this.matter.world, body);
    this.bodies.set(combatant.id, body);
    combatant.bodyId = body.id;
  }

  private tickTimers(dt: number): void {
    for (const combatant of [this.player, ...this.enemies]) {
      combatant.cooldown = Math.max(0, combatant.cooldown - dt);
      combatant.flash = Math.max(0, combatant.flash - dt);
    }
  }

  private updatePlayer(input: InputState): void {
    const movement = normalize(input.move);
    this.setVelocity(this.player, { x: movement.x * this.player.speed, y: movement.y * this.player.speed });

    if (input.aim.x !== 0 || input.aim.y !== 0) this.player.facing = Math.atan2(input.aim.y, input.aim.x);
    if (input.attacking && this.player.cooldown === 0) this.swing(this.player, this.enemies, 'slash');
  }

  private updateEnemies(): void {
    for (const enemy of this.enemies) {
      const toPlayer = {
        x: this.player.position.x - enemy.position.x,
        y: this.player.position.y - enemy.position.y,
      };
      const dir = normalize(toPlayer);
      const d = length(toPlayer);
      enemy.facing = Math.atan2(dir.y, dir.x);

      if (enemy.kind === 'rangedEnemy') {
        const preferred = 170;
        const moveSign = d < preferred ? -1 : 1;
        const shouldMove = Math.abs(d - preferred) > 26;
        this.setVelocity(enemy, shouldMove ? { x: dir.x * enemy.speed * moveSign, y: dir.y * enemy.speed * moveSign } : { x: 0, y: 0 });
        if (d <= enemy.attackRange && enemy.cooldown === 0) this.shoot(enemy);
      } else {
        const holdDistance = enemy.attackRange + this.player.radius - 8;
        this.setVelocity(enemy, d > holdDistance ? { x: dir.x * enemy.speed, y: dir.y * enemy.speed } : { x: 0, y: 0 });
        if (d <= enemy.attackRange + this.player.radius && enemy.cooldown === 0) this.swing(enemy, [this.player], 'arc');
      }

      if (distance(enemy.position, this.player.position) <= enemy.radius + this.player.radius + 2) {
        this.addImpact({
          x: (enemy.position.x + this.player.position.x) / 2,
          y: (enemy.position.y + this.player.position.y) / 2,
        });
      }
    }
  }

  private setVelocity(combatant: Combatant, velocity: Vec2): void {
    const body = this.bodies.get(combatant.id);
    if (body) {
      Matter.Body.setVelocity(body, {
        x: velocity.x / MATTER_TICKS_PER_SECOND,
        y: velocity.y / MATTER_TICKS_PER_SECOND,
      });
    }
  }

  private syncPositions(): void {
    for (const combatant of [this.player, ...this.enemies]) {
      const body = this.bodies.get(combatant.id);
      if (!body) continue;
      combatant.position = { x: body.position.x, y: body.position.y };
    }
  }

  private swing(attacker: Combatant, targets: Combatant[], style: Strike['style']): void {
    let hit = false;
    for (const target of targets) {
      const d = distance(attacker.position, target.position) - attacker.radius - target.radius;
      const targetAngle = angleTo(attacker.position, target.position);
      if (d <= attacker.attackRange && angleDelta(attacker.facing, targetAngle) <= attacker.attackArc / 2) {
        target.flash = 0.22;
        this.addImpact(target.position);
        hit = true;
      }
    }

    attacker.cooldown = attacker.attackCooldown;
    this.strikes.push({
      id: this.nextEffectId++,
      position: { ...attacker.position },
      angle: attacker.facing,
      range: attacker.attackRange,
      arc: attacker.attackArc,
      ttl: hit ? 0.2 : 0.16,
      color: attacker.color,
      style,
    });
  }

  private shoot(attacker: Combatant): void {
    const dir = normalize({
      x: this.player.position.x - attacker.position.x,
      y: this.player.position.y - attacker.position.y,
    });
    attacker.cooldown = attacker.attackCooldown;
    attacker.flash = 0.08;
    this.projectiles.push({
      id: this.nextProjectileId++,
      position: {
        x: attacker.position.x + dir.x * (attacker.radius + 8),
        y: attacker.position.y + dir.y * (attacker.radius + 8),
      },
      velocity: { x: dir.x * 285, y: dir.y * 285 },
      radius: 5,
      ttl: 2.2,
    });
  }

  private tickProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.y += projectile.velocity.y * dt;
      projectile.ttl -= dt;

      const outside =
        projectile.position.x < -20 ||
        projectile.position.x > ARENA_WIDTH + 20 ||
        projectile.position.y < -20 ||
        projectile.position.y > ARENA_HEIGHT + 20;

      if (outside || projectile.ttl <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (distance(projectile.position, this.player.position) <= projectile.radius + this.player.radius) {
        this.player.flash = 0.25;
        this.addImpact(projectile.position);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private tickEffects(dt: number): void {
    for (let i = this.strikes.length - 1; i >= 0; i -= 1) {
      this.strikes[i].ttl -= dt;
      if (this.strikes[i].ttl <= 0) this.strikes.splice(i, 1);
    }
    for (let i = this.impacts.length - 1; i >= 0; i -= 1) {
      this.impacts[i].ttl -= dt;
      if (this.impacts[i].ttl <= 0) this.impacts.splice(i, 1);
    }
  }

  private addImpact(position: Vec2): void {
    const last = this.impacts[this.impacts.length - 1];
    if (last && distance(last.position, position) < 8 && last.ttl > 0.08) return;
    this.impacts.push({ id: this.nextEffectId++, position: { ...position }, ttl: 0.18 });
  }
}
