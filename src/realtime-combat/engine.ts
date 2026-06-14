import Matter from 'matter-js';
import { buildAttackTable, resolveDamage, rollOutcome, type AttackOutcome } from './attackTable.js';
import { createDefaultBattleSetup } from './battleSetup.js';
import { enemyById } from './enemyCatalog.js';
import { attackInterval, balanceRoll, effectiveBalance, maxHp, maxMp } from './formulas.js';
import { createRng, type Rng } from './rng.js';
import type { Attributes, BattleResult, BattleSetup, CombatActorRef, CombatEvent, Combatant, DamageText, EnemyDefinition, EnemySpawn, Impact, InputState, Projectile, Strike, Vec2 } from './types.js';
import { ARENA_HEIGHT, ARENA_WIDTH } from './types.js';

const WALL_THICKNESS = 64;
const PLAYER_ID = 1;
const MATTER_TICKS_PER_SECOND = 60;
const BASE_ATTACK_INTERVAL = 0.82;
const BASIC_DAMAGE: [number, number] = [4, 8];
const BASIC_BALANCE = 0.55;

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

function makeCombatant(
  params: Omit<Combatant, 'cooldown' | 'flash' | 'bodyId' | 'hp' | 'maxHp' | 'mp' | 'maxMp'>,
): Combatant {
  const hp = maxHp(params.attrs.vit);
  const mp = maxMp(params.attrs.wil);
  return { ...params, hp, maxHp: hp, mp, maxMp: mp, cooldown: 0, flash: 0, bodyId: null };
}

function cloneAttrs(attrs: Attributes): Attributes {
  return { ...attrs };
}

function makeEnemy(id: number, definition: EnemyDefinition, spawn: EnemySpawn, attrsOverride?: Attributes): Combatant {
  const attrs = cloneAttrs(attrsOverride ?? definition.attrs);
  return makeCombatant({
    id,
    kind: definition.kind,
    definitionId: definition.id,
    name: definition.name,
    attrs,
    radius: definition.radius,
    color: definition.color,
    position: { ...spawn.position },
    facing: spawn.facing ?? 0,
    speed: definition.speed,
    attackRange: definition.attackRange,
    attackArc: definition.attackArc,
    attackCooldown: attackInterval(definition.baseAttackInterval, attrs.agi),
    armor: definition.armor,
    reductionRate: definition.reductionRate,
    parryRate: definition.parryRate,
    blockRate: definition.blockRate,
  });
}

export class RealtimeCombatEngine {
  readonly player: Combatant;
  readonly enemies: Combatant[];
  readonly projectiles: Projectile[] = [];
  readonly strikes: Strike[] = [];
  readonly impacts: Impact[] = [];
  readonly damageTexts: DamageText[] = [];

  private readonly matter = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  private readonly bodies = new Map<number, Matter.Body>();
  private readonly rng: Rng;
  private readonly onEvent?: (event: CombatEvent) => void;
  private nextEffectId = 1;
  private nextProjectileId = 1;
  private nextLogId = 1;
  private result: BattleResult | null = null;

  constructor(opts: { seed?: number; onEvent?: (event: CombatEvent) => void; setup?: BattleSetup; enemyAttrsOverride?: Attributes } = {}) {
    this.rng = createRng(opts.seed ?? Date.now());
    this.onEvent = opts.onEvent;
    const setup = opts.setup ?? createDefaultBattleSetup();
    this.player = makeCombatant({
      id: PLAYER_ID,
      kind: 'player',
      name: setup.player.name,
      attrs: cloneAttrs(setup.player.attrs),
      radius: 17,
      color: 0x5b8def,
      position: { ...setup.player.position },
      facing: setup.player.facing,
      speed: 230,
      attackRange: 88,
      attackArc: Math.PI / 2,
      attackCooldown: attackInterval(BASE_ATTACK_INTERVAL, setup.player.attrs.agi),
      armor: 0,
      reductionRate: 0,
      parryRate: 0,
      blockRate: 0,
    });

    this.enemies = setup.enemies.map((spawn, index) =>
      makeEnemy(2 + index, enemyById(spawn.enemyId), spawn, opts.enemyAttrsOverride),
    );

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
    if (!this.result) {
      this.updatePlayer(input);
      this.updateEnemies();
    } else {
      this.stopBodies();
    }
    Matter.Engine.update(this.matter, safeDt * 1000);
    this.syncPositions();
    if (!this.result) this.tickProjectiles(safeDt);
    else this.projectiles.length = 0;
    this.tickEffects(safeDt);
    this.checkBattleEnd();
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
    if (input.attacking && this.player.cooldown === 0 && this.player.hp > 0) this.swing(this.player, this.enemies, 'slash');
  }

  private updateEnemies(): void {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || this.player.hp <= 0) {
        this.setVelocity(enemy, { x: 0, y: 0 });
        continue;
      }
      const toPlayer = {
        x: this.player.position.x - enemy.position.x,
        y: this.player.position.y - enemy.position.y,
      };
      const dir = normalize(toPlayer);
      const d = length(toPlayer);
      enemy.facing = Math.atan2(dir.y, dir.x);

      if (enemy.kind === 'rangedEnemy') {
        const definition = this.definitionFor(enemy);
        const preferred = definition.preferredRange ?? 170;
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

  private stopBodies(): void {
    this.setVelocity(this.player, { x: 0, y: 0 });
    for (const enemy of this.enemies) this.setVelocity(enemy, { x: 0, y: 0 });
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
      if (target.hp <= 0) continue;
      const d = distance(attacker.position, target.position) - attacker.radius - target.radius;
      const targetAngle = angleTo(attacker.position, target.position);
      if (d <= attacker.attackRange && angleDelta(attacker.facing, targetAngle) <= attacker.attackArc / 2) {
        const damage = this.resolveBasicAttack(attacker, target);
        if (damage > 0) {
          target.flash = 0.22;
          this.addImpact(target.position);
          this.addDamageText(target.position, damage);
        }
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
    const projectileSpeed = this.definitionFor(attacker).projectileSpeed ?? 285;
    this.projectiles.push({
      id: this.nextProjectileId++,
      ownerId: attacker.id,
      position: {
        x: attacker.position.x + dir.x * (attacker.radius + 8),
        y: attacker.position.y + dir.y * (attacker.radius + 8),
      },
      velocity: { x: dir.x * projectileSpeed, y: dir.y * projectileSpeed },
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
        const attacker = this.enemies.find((enemy) => enemy.id === projectile.ownerId);
        const damage = attacker ? this.resolveBasicAttack(attacker, this.player) : 0;
        if (damage > 0) {
          this.player.flash = 0.25;
          this.addImpact(projectile.position);
          this.addDamageText(this.player.position, damage);
        }
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
    for (let i = this.damageTexts.length - 1; i >= 0; i -= 1) {
      this.damageTexts[i].ttl -= dt;
      this.damageTexts[i].position.y -= 28 * dt;
      if (this.damageTexts[i].ttl <= 0) this.damageTexts.splice(i, 1);
    }
  }

  private addImpact(position: Vec2): void {
    const last = this.impacts[this.impacts.length - 1];
    if (last && distance(last.position, position) < 8 && last.ttl > 0.08) return;
    this.impacts.push({ id: this.nextEffectId++, position: { ...position }, ttl: 0.18 });
  }

  private addDamageText(position: Vec2, damage: number): void {
    this.damageTexts.push({
      id: this.nextEffectId++,
      position: { x: position.x, y: position.y - 28 },
      text: String(damage),
      ttl: 0.72,
    });
  }

  private resolveBasicAttack(attacker: Combatant, target: Combatant): number {
    const table = buildAttackTable({
      attacker: attacker.attrs,
      defender: target.attrs,
      defenderParryRate: target.parryRate,
      defenderBlockRate: target.blockRate,
      attackerCanCrit: true,
      attackerCrushRate: 0,
      canBeParried: true,
      canBeBlocked: true,
    });
    const outcome = rollOutcome(table, this.rng);
    const balance = effectiveBalance(BASIC_BALANCE, attacker.attrs.dex);
    const base = balanceRoll(this.rng, BASIC_DAMAGE[0], BASIC_DAMAGE[1], balance) + attacker.attrs.str;
    const result = resolveDamage(outcome, base, { armor: target.armor, reductionRate: target.reductionRate });
    const damage = result.damage;

    if (damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      this.pushDamageEvent(attacker, target, outcome, damage);
      if (target.hp <= 0) this.pushDeathEvent(attacker, target);
    } else {
      this.pushMissEvent(attacker, target, outcome);
    }
    return damage;
  }

  private definitionFor(enemy: Combatant): EnemyDefinition {
    if (!enemy.definitionId) throw new Error(`${enemy.name} does not have an enemy definition`);
    return enemyById(enemy.definitionId);
  }

  private checkBattleEnd(): void {
    if (this.result) return;
    if (this.player.hp <= 0) {
      this.finishBattle('playerLost', this.enemies.find((enemy) => enemy.hp > 0) ?? this.player);
      return;
    }
    if (this.enemies.every((enemy) => enemy.hp <= 0)) {
      this.finishBattle('playerWon', this.player);
    }
  }

  private actorRef(combatant: Combatant): CombatActorRef {
    return {
      id: combatant.id,
      side: combatant.kind === 'player' ? 'player' : 'enemy',
      name: combatant.name,
    };
  }

  private pushDamageEvent(attacker: Combatant, target: Combatant, outcome: AttackOutcome, damage: number): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'damage',
      source: this.actorRef(attacker),
      target: this.actorRef(target),
      action: { kind: 'basicAttack', name: '普攻' },
      amount: damage,
      outcome,
    });
  }

  private pushMissEvent(attacker: Combatant, target: Combatant, outcome: AttackOutcome): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'miss',
      source: this.actorRef(attacker),
      target: this.actorRef(target),
      action: { kind: 'basicAttack', name: '普攻' },
      outcome,
    });
  }

  private pushDeathEvent(attacker: Combatant, target: Combatant): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'death',
      source: this.actorRef(attacker),
      target: this.actorRef(target),
    });
  }

  private finishBattle(result: BattleResult, source: Combatant): void {
    this.result = result;
    this.stopBodies();
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'battleEnd',
      source: this.actorRef(source),
      result,
    });
  }
}
