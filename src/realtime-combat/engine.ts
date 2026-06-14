import Matter from 'matter-js';
import { getDefaultAmmo } from './ammoCatalog.js';
import { buildAttackTable, resolveDamage, rollOutcome, type AttackOutcome } from './attackTable.js';
import { createDefaultBattleSetup } from './battleSetup.js';
import { enemyById } from './enemyCatalog.js';
import { equipmentDefense, getOffhandWeapon, getWeapon, normalizeLoadout } from './equipmentCatalog.js';
import { attackInterval, balanceRoll, effectiveBalance, maxHp, maxMp } from './formulas.js';
import { itemById } from './itemCatalog.js';
import { createRng, type Rng } from './rng.js';
import { skillById, type SkillDefinition } from './skillCatalog.js';
import type { AiState, ArenaObstacle, Attributes, BattleResult, BattleSetup, CombatActorRef, CombatEvent, CombatFaction, CombatHand, CombatHandSide, Combatant, DamageText, EnemyDefinition, EnemySpawn, Impact, InputState, ItemId, Projectile, SkillId, StatusEffect, Strike, Vec2, WeaponDefinition } from './types.js';
import { ARENA_HEIGHT, ARENA_WIDTH } from './types.js';

const WALL_THICKNESS = 64;
const PLAYER_ID = 1;
const MATTER_TICKS_PER_SECOND = 60;
const BASE_ATTACK_INTERVAL = 0.82;
const BASIC_DAMAGE: [number, number] = [4, 8];
const BASIC_BALANCE = 0.55;
const BASIC_RANGE = 88;
const BASIC_ARC = Math.PI / 2;
const DEFAULT_ALERT_RANGE = 230;
const DEFAULT_LEASH_RANGE = 420;
const RETURN_DISTANCE = 8;

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

function segmentIntersectsRect(from: Vec2, to: Vec2, rect: ArenaObstacle): boolean {
  const minX = rect.position.x - rect.width / 2;
  const maxX = rect.position.x + rect.width / 2;
  const minY = rect.position.y - rect.height / 2;
  const maxY = rect.position.y + rect.height / 2;

  if (pointInRect(from, minX, maxX, minY, maxY) || pointInRect(to, minX, maxX, minY, maxY)) return true;

  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  return corners.some((corner, index) => segmentsIntersect(from, to, corner, corners[(index + 1) % corners.length]));
}

function pointInRect(point: Vec2, minX: number, maxX: number, minY: number, maxY: number): boolean {
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denominator = cross(abx, aby, cdx, cdy);
  if (Math.abs(denominator) < 1e-8) return false;
  const t = cross(acx, acy, cdx, cdy) / denominator;
  const u = cross(acx, acy, abx, aby) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function makeCombatant(
  params: Omit<Combatant, 'flash' | 'bodyId' | 'hp' | 'maxHp' | 'mp' | 'maxMp'>,
): Combatant {
  const hp = maxHp(params.attrs.vit);
  const mp = maxMp(params.attrs.wil);
  return { ...params, hp, maxHp: hp, mp, maxMp: mp, flash: 0, bodyId: null };
}

function attackRangeOf(hand?: CombatHand): number {
  return hand?.weapon.range ?? BASIC_RANGE;
}

function attackArcOf(hand?: CombatHand): number {
  return hand?.weapon.arc ?? BASIC_ARC;
}

function targetInMeleeRange(attacker: Combatant, target: Combatant, hand: CombatHand): boolean {
  return distance(attacker.position, target.position) - target.radius <= attackRangeOf(hand);
}

function cloneAttrs(attrs: Attributes): Attributes {
  return { ...attrs };
}

function makeEnemy(
  id: number,
  definition: EnemyDefinition,
  spawn: EnemySpawn,
  faction: CombatFaction,
  attrsOverride?: Attributes,
): Combatant {
  const attrs = cloneAttrs(attrsOverride ?? spawn.attrs ?? definition.attrs);
  const loadout = normalizeLoadout(definition.loadout);
  const hands = handsFromLoadout(loadout, attrs);
  const defense = equipmentDefense(loadout);
  return makeCombatant({
    id,
    kind: definition.kind,
    faction,
    definitionId: definition.id,
    name: spawn.name ?? definition.name,
    attrs,
    radius: definition.radius,
    color: definition.color,
    position: { ...spawn.position },
    homePosition: { ...spawn.position },
    facing: spawn.facing ?? 0,
    speed: definition.speed,
    armor: definition.armor + defense.armor,
    reductionRate: Math.min(1, definition.reductionRate + defense.reductionRate),
    parryRate: Math.min(1, definition.parryRate + defense.parryRate),
    blockRate: Math.min(1, definition.blockRate + defense.blockRate),
    hands,
    skills: definition.skills ?? [],
    skillSlots: definition.skills ?? [],
    skillCooldowns: {},
    itemSlots: [],
    itemUsed: [],
    aiState: spawn.aiState ?? definition.aiState ?? 'guard',
    defaultAiState: spawn.aiState ?? definition.aiState ?? 'guard',
    alertRange: spawn.alertRange ?? definition.alertRange ?? DEFAULT_ALERT_RANGE,
    leashRange: spawn.leashRange ?? definition.leashRange ?? DEFAULT_LEASH_RANGE,
  });
}

function handsFromLoadout(loadout: Parameters<typeof normalizeLoadout>[0], attrs: Attributes): CombatHand[] {
  const normalized = normalizeLoadout(loadout);
  const mainWeapon = getWeapon(normalized);
  const hands: CombatHand[] = [
    {
      side: 'main',
      weapon: mainWeapon,
      cooldown: 0,
      interval: attackInterval(mainWeapon.interval, attrs.agi, mainWeapon.agiApplies),
    },
  ];
  const offhandWeapon = getOffhandWeapon(normalized);
  if (offhandWeapon) {
    hands.push({
      side: 'off',
      weapon: offhandWeapon,
      cooldown: 0,
      interval: attackInterval(offhandWeapon.interval, attrs.agi, offhandWeapon.agiApplies),
    });
  }
  return hands;
}

function baseDamageWithWeapon(attacker: Combatant, rng: Rng, weapon?: WeaponDefinition): number {
  if (!weapon) {
    const balance = effectiveBalance(BASIC_BALANCE, attacker.attrs.dex);
    return balanceRoll(rng, BASIC_DAMAGE[0], BASIC_DAMAGE[1], balance) + attacker.attrs.str;
  }

  const balance = effectiveBalance(weapon.balance, weapon.dexAmp ? attacker.attrs.dex : 0);
  const rolled = balanceRoll(rng, weapon.damage[0], weapon.damage[1], balance);
  return rolled + (weapon.strApplies ? attacker.attrs.str : 0);
}

export class RealtimeCombatEngine {
  readonly player: Combatant;
  readonly enemies: Combatant[];
  readonly allies: Combatant[];
  readonly neutrals: Combatant[];
  readonly obstacles: ArenaObstacle[];
  readonly projectiles: Projectile[] = [];
  readonly strikes: Strike[] = [];
  readonly impacts: Impact[] = [];
  readonly damageTexts: DamageText[] = [];
  readonly statusEffects: StatusEffect[] = [];

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
    const playerLoadout = normalizeLoadout(setup.player.loadout);
    const playerHands = handsFromLoadout(playerLoadout, setup.player.attrs);
    const playerDefense = equipmentDefense(playerLoadout);
    this.player = makeCombatant({
      id: PLAYER_ID,
      kind: 'player',
      faction: 'player',
      name: setup.player.name,
      attrs: cloneAttrs(setup.player.attrs),
      radius: 17,
      color: 0x5b8def,
      position: { ...setup.player.position },
      homePosition: { ...setup.player.position },
      facing: setup.player.facing,
      speed: 230,
      armor: playerDefense.armor,
      reductionRate: playerDefense.reductionRate,
      parryRate: playerDefense.parryRate,
      blockRate: playerDefense.blockRate,
      hands: playerHands,
      skills: setup.player.actionLoadout.skillSlots.filter((skillId): skillId is SkillId => !!skillId),
      skillSlots: [...setup.player.actionLoadout.skillSlots],
      skillCooldowns: {},
      itemSlots: [...setup.player.actionLoadout.itemSlots],
      itemUsed: setup.player.actionLoadout.itemSlots.map(() => false),
      aiState: 'combat',
      defaultAiState: 'combat',
      alertRange: 0,
      leashRange: 0,
    });

    let nextActorId = 2;
    this.enemies = setup.enemies.map((spawn) => makeEnemy(nextActorId++, enemyById(spawn.enemyId), spawn, 'enemy', opts.enemyAttrsOverride));
    this.allies = (setup.allies ?? []).map((spawn) => makeEnemy(nextActorId++, enemyById(spawn.enemyId), spawn, 'ally'));
    this.neutrals = (setup.neutrals ?? []).map((spawn) => makeEnemy(nextActorId++, enemyById(spawn.enemyId), spawn, 'neutral'));
    this.obstacles = setup.obstacles ?? [];

    this.addWalls();
    this.addObstacles();
    for (const combatant of this.combatants()) this.addBody(combatant);
  }

  destroy(): void {
    Matter.Engine.clear(this.matter);
    this.bodies.clear();
  }

  usePlayerSkillSlot(slotIndex: number): void {
    const skillId = this.player.skillSlots[slotIndex];
    if (!skillId || this.result || this.player.hp <= 0) return;
    if (skillId === 'heal') this.useHeal(this.player, skillById(skillId));
  }

  usePlayerItemSlot(slotIndex: number): void {
    const itemId = this.player.itemSlots[slotIndex];
    if (!itemId || this.result || this.player.hp <= 0 || this.player.itemUsed[slotIndex]) return;
    this.useItem(this.player, itemId, slotIndex);
  }

  step(input: InputState, dt: number): void {
    const safeDt = Math.min(dt, 1 / 30);
    this.tickTimers(safeDt);
    if (!this.result) {
      this.updatePlayer(input);
      this.updateNpcCombatants();
    } else {
      this.stopBodies();
    }
    Matter.Engine.update(this.matter, safeDt * 1000);
    this.syncPositions();
    if (!this.result) this.tickProjectiles(safeDt);
    else this.projectiles.length = 0;
    if (!this.result) this.tickStatusEffects(safeDt);
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

  private addObstacles(): void {
    for (const obstacle of this.obstacles) {
      Matter.Composite.add(
        this.matter.world,
        Matter.Bodies.rectangle(obstacle.position.x, obstacle.position.y, obstacle.width, obstacle.height, {
          isStatic: true,
          restitution: 0.2,
        }),
      );
    }
  }

  private addBody(combatant: Combatant): void {
    const body = Matter.Bodies.circle(combatant.position.x, combatant.position.y, combatant.radius, {
      frictionAir: 0.2,
      restitution: 0.08,
    });
    Matter.Body.setMass(body, combatant.faction === 'player' ? 1 : 8);
    Matter.Composite.add(this.matter.world, body);
    this.bodies.set(combatant.id, body);
    combatant.bodyId = body.id;
  }

  private tickTimers(dt: number): void {
    for (const combatant of this.combatants()) {
      for (const hand of combatant.hands) {
        hand.cooldown = Math.max(0, hand.cooldown - dt);
      }
      for (const skillId of combatant.skills) {
        combatant.skillCooldowns[skillId] = Math.max(0, (combatant.skillCooldowns[skillId] ?? 0) - dt);
      }
      combatant.flash = Math.max(0, combatant.flash - dt);
    }
  }

  private updatePlayer(input: InputState): void {
    const movement = normalize(input.move);
    this.setVelocity(this.player, { x: movement.x * this.player.speed, y: movement.y * this.player.speed });

    if (input.aim.x !== 0 || input.aim.y !== 0) this.player.facing = Math.atan2(input.aim.y, input.aim.x);
    if (input.attacking && this.player.hp > 0) this.performReadyAttacks(this.player, this.attackableTargetsFor(this.player));
  }

  private updateNpcCombatants(): void {
    for (const actor of this.npcCombatants()) {
      if (actor.hp <= 0 || this.player.hp <= 0) {
        this.setVelocity(actor, { x: 0, y: 0 });
        continue;
      }

      if (actor.aiState === 'guard' || actor.aiState === 'patrol') {
        this.updateGuardState(actor);
        continue;
      }

      if (actor.aiState === 'returning') {
        this.updateReturningState(actor);
        continue;
      }

      this.updateCombatState(actor);
    }
  }

  private updateGuardState(actor: Combatant): void {
    this.setVelocity(actor, { x: 0, y: 0 });
    const target = this.alertTargetFor(actor);
    if (target) {
      actor.aiState = 'combat';
      actor.facing = angleTo(actor.position, target.position);
    }
  }

  private updateReturningState(actor: Combatant): void {
    actor.retaliationTargetId = undefined;
    const toHome = {
      x: actor.homePosition.x - actor.position.x,
      y: actor.homePosition.y - actor.position.y,
    };
    const d = length(toHome);
    if (d <= RETURN_DISTANCE) {
      this.moveBodyTo(actor, actor.homePosition);
      actor.aiState = actor.defaultAiState === 'patrol' ? 'patrol' : 'guard';
      this.setVelocity(actor, { x: 0, y: 0 });
      return;
    }
    const dir = normalize(toHome);
    actor.facing = Math.atan2(dir.y, dir.x);
    this.setVelocity(actor, { x: dir.x * actor.speed, y: dir.y * actor.speed });
  }

  private updateCombatState(actor: Combatant): void {
    if (distance(actor.position, actor.homePosition) > actor.leashRange) {
      actor.aiState = 'returning';
      return;
    }

    const target = this.targetFor(actor);
    if (!target) {
      actor.aiState = 'returning';
      return;
    }

    const toTarget = {
      x: target.position.x - actor.position.x,
      y: target.position.y - actor.position.y,
    };
    const dir = normalize(toTarget);
    const d = length(toTarget);
    actor.facing = Math.atan2(dir.y, dir.x);
    if (this.tryUseSkill(actor, target, d)) return;

    if (this.hasProjectileAttack(actor)) {
      const definition = this.definitionFor(actor);
      const preferred = definition.preferredRange ?? 170;
      const moveSign = d < preferred ? -1 : 1;
      const shouldMove = Math.abs(d - preferred) > 26;
      this.setVelocity(actor, shouldMove ? { x: dir.x * actor.speed * moveSign, y: dir.y * actor.speed * moveSign } : { x: 0, y: 0 });
      if (d <= this.maxAttackRange(actor) && this.hasReadyHand(actor)) this.performReadyAttacks(actor, this.attackableTargetsFor(actor));
    } else {
      const holdDistance = this.maxAttackRange(actor) + target.radius - 8;
      this.setVelocity(actor, d > holdDistance ? { x: dir.x * actor.speed, y: dir.y * actor.speed } : { x: 0, y: 0 });
      if (d <= this.maxAttackRange(actor) + target.radius && this.hasReadyHand(actor)) this.performReadyAttacks(actor, this.attackableTargetsFor(actor));
    }

    if (distance(actor.position, target.position) <= actor.radius + target.radius + 2) {
      this.addImpact({
        x: (actor.position.x + target.position.x) / 2,
        y: (actor.position.y + target.position.y) / 2,
      });
    }
  }

  private setVelocity(combatant: Combatant, velocity: Vec2): void {
    const body = this.bodies.get(combatant.id);
    if (body) {
      const isStopped = Math.abs(velocity.x) < 0.001 && Math.abs(velocity.y) < 0.001;
      if (combatant.faction !== 'player' && body.isStatic !== isStopped) {
        Matter.Body.setStatic(body, isStopped);
      }
      Matter.Body.setVelocity(body, {
        x: velocity.x / MATTER_TICKS_PER_SECOND,
        y: velocity.y / MATTER_TICKS_PER_SECOND,
      });
    }
  }

  private moveBodyTo(combatant: Combatant, position: Vec2): void {
    const body = this.bodies.get(combatant.id);
    if (!body) return;
    if (body.isStatic) Matter.Body.setStatic(body, false);
    Matter.Body.setPosition(body, position);
    combatant.position = { ...position };
  }

  private stopBodies(): void {
    for (const combatant of this.combatants()) this.setVelocity(combatant, { x: 0, y: 0 });
  }

  private syncPositions(): void {
    for (const combatant of this.combatants()) {
      const body = this.bodies.get(combatant.id);
      if (!body) continue;
      combatant.position = { x: body.position.x, y: body.position.y };
    }
  }

  private performReadyAttacks(attacker: Combatant, targets: Combatant[]): void {
    const readyHands = attacker.hands.filter((hand) => hand.cooldown === 0);
    for (const hand of readyHands) {
      if (hand.weapon.attackMode === 'projectile') this.shoot(attacker, hand);
      else this.swing(attacker, hand, targets, attacker.kind === 'player' ? 'slash' : 'arc');
    }
  }

  private swing(attacker: Combatant, hand: CombatHand, targets: Combatant[], style: Strike['style']): void {
    let hit = false;
    for (const target of targets) {
      if (target.hp <= 0) continue;
      const targetAngle = angleTo(attacker.position, target.position);
      const arc = attackArcOf(hand);
      if (targetInMeleeRange(attacker, target, hand) && angleDelta(attacker.facing, targetAngle) <= arc / 2 && this.hasLineOfSight(attacker.position, target.position)) {
        const damage = this.resolveBasicAttackWithWeapon(attacker, target, hand.weapon, hand.side);
        if (damage > 0) {
          target.flash = 0.22;
          this.addImpact(target.position);
          this.addDamageText(target.position, damage);
        }
        hit = true;
      }
    }

    hand.cooldown = hand.interval;
    this.strikes.push({
      id: this.nextEffectId++,
      position: { ...attacker.position },
      angle: attacker.facing,
      range: attackRangeOf(hand),
      arc: attackArcOf(hand),
      ttl: hit ? 0.2 : 0.16,
      color: attacker.color,
      style,
    });
  }

  private shoot(attacker: Combatant, hand: CombatHand): void {
    const weapon = hand.weapon;
    if (!weapon.projectile) return;
    const parallelHands = attacker.hands.filter((item) => item.cooldown === 0 && item.weapon.projectile);
    const laneIndex = Math.max(0, parallelHands.findIndex((item) => item === hand));
    const laneOffset = (laneIndex - (parallelHands.length - 1) / 2) * 14;
    hand.cooldown = hand.interval;
    attacker.flash = 0.08;

    const projectile = weapon.projectile;
    const ammo = getDefaultAmmo(projectile.ammoType);
    const shotCount = projectile.shotsPerAttack;
    const range = Math.min(weapon.range, ammo.range);
    for (let i = 0; i < shotCount; i += 1) {
      const spreadOffset = shotCount === 1 ? 0 : (i - (shotCount - 1) / 2) * projectile.spreadAngle;
      const angle = attacker.facing + spreadOffset;
      const shotDir = { x: Math.cos(angle), y: Math.sin(angle) };
      const sideDir = { x: -Math.sin(attacker.facing), y: Math.cos(attacker.facing) };
      this.projectiles.push({
        id: this.nextProjectileId++,
        ownerId: attacker.id,
        weaponId: weapon.id,
        hand: hand.side,
        position: {
          x: attacker.position.x + shotDir.x * (attacker.radius + 8) + sideDir.x * laneOffset,
          y: attacker.position.y + shotDir.y * (attacker.radius + 8) + sideDir.y * laneOffset,
        },
        velocity: { x: shotDir.x * ammo.speed, y: shotDir.y * ammo.speed },
        radius: ammo.radius,
        ttl: range / ammo.speed,
        distanceLeft: range,
      });
    }
  }

  private tickProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      const dx = projectile.velocity.x * dt;
      const dy = projectile.velocity.y * dt;
      projectile.position.x += dx;
      projectile.position.y += dy;
      projectile.distanceLeft -= Math.hypot(dx, dy);
      projectile.ttl -= dt;

      const outside =
        projectile.position.x < -20 ||
        projectile.position.x > ARENA_WIDTH + 20 ||
        projectile.position.y < -20 ||
        projectile.position.y > ARENA_HEIGHT + 20;

      if (outside || projectile.ttl <= 0 || projectile.distanceLeft <= 0 || this.projectileHitsObstacle(projectile)) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const attacker = this.combatantById(projectile.ownerId);
      if (!attacker || attacker.hp <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const weapon = this.weaponById(attacker, projectile.weaponId);
      let removed = false;
      for (const target of this.attackableTargetsFor(attacker)) {
        if (target.hp <= 0) continue;
        if (distance(projectile.position, target.position) > projectile.radius + target.radius) continue;
        const damage = this.resolveBasicAttackWithWeapon(attacker, target, weapon, projectile.hand);
        if (damage > 0) {
          target.flash = 0.25;
          this.addImpact(projectile.position);
          this.addDamageText(target.position, damage);
        }
        this.projectiles.splice(i, 1);
        removed = true;
        break;
      }
      if (removed) continue;
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
      this.damageTexts[i].position.y -= 42 * dt;
      if (this.damageTexts[i].ttl <= 0) this.damageTexts.splice(i, 1);
    }
  }

  private addImpact(position: Vec2): void {
    const last = this.impacts[this.impacts.length - 1];
    if (last && distance(last.position, position) < 8 && last.ttl > 0.08) return;
    this.impacts.push({ id: this.nextEffectId++, position: { ...position }, ttl: 0.18 });
  }

  private addDamageText(position: Vec2, damage: number, opts: { color?: number; yOffset?: number; prefix?: string } = {}): void {
    this.damageTexts.push({
      id: this.nextEffectId++,
      position: { x: position.x, y: position.y + (opts.yOffset ?? -28) },
      text: `${opts.prefix ?? ''}${damage}`,
      ttl: 1.25,
      color: opts.color,
    });
  }

  private tryUseSkill(attacker: Combatant, target: Combatant, distanceToTarget: number): boolean {
    if (attacker.skills.includes('charge') && (attacker.skillCooldowns.charge ?? 0) === 0) {
      const skill = skillById('charge');
      if (distanceToTarget >= (skill.minRange ?? 0) && distanceToTarget <= (skill.maxRange ?? Infinity)) {
        this.useCharge(attacker, target, skill);
        return true;
      }
    }

    if (attacker.skills.includes('bite') && (attacker.skillCooldowns.bite ?? 0) === 0) {
      const skill = skillById('bite');
      const hand = attacker.hands.find((item) => item.weapon.attackMode === 'melee') ?? attacker.hands[0];
      if (hand && targetInMeleeRange(attacker, target, hand) && this.hasLineOfSight(attacker.position, target.position)) {
        this.useBite(attacker, target, skill, hand);
        return true;
      }
    }

    return false;
  }

  private useCharge(attacker: Combatant, target: Combatant, skill: SkillDefinition): void {
    const dir = normalize({
      x: attacker.position.x - target.position.x,
      y: attacker.position.y - target.position.y,
    });
    const stopDistance = attacker.radius + target.radius + 4;
    this.moveBodyTo(attacker, {
      x: target.position.x + dir.x * stopDistance,
      y: target.position.y + dir.y * stopDistance,
    });
    attacker.facing = angleTo(attacker.position, target.position);
    attacker.skillCooldowns.charge = skill.cooldown;
    const hand = attacker.hands[0];
    const damage = this.resolveAttackWithWeapon(attacker, target, hand?.weapon, hand?.side, skill.damageMultiplier, skill.name);
    if (damage > 0) {
      target.flash = 0.22;
      this.addImpact(target.position);
      this.addDamageText(target.position, damage);
    }
  }

  private useBite(attacker: Combatant, target: Combatant, skill: SkillDefinition, hand: CombatHand): void {
    attacker.skillCooldowns.bite = skill.cooldown;
    const damage = this.resolveAttackWithWeapon(attacker, target, hand.weapon, hand.side, skill.damageMultiplier, skill.name);
    if (damage > 0) {
      target.flash = 0.22;
      this.addImpact(target.position);
      this.addDamageText(target.position, damage);
      if (this.rng() < (skill.bleedChance ?? 0)) {
        this.applyBleed(attacker, target, Math.max(1, Math.round(damage * (skill.bleedDamageRatio ?? 0))), skill);
      }
    }
  }

  private applyBleed(attacker: Combatant, target: Combatant, damagePerTick: number, skill: SkillDefinition): void {
    this.statusEffects.push({
      id: this.nextEffectId++,
      statusId: 'bleed',
      name: '出血',
      sourceId: attacker.id,
      targetId: target.id,
      amountPerTick: damagePerTick,
      effectType: 'damage',
      remaining: skill.bleedDuration ?? 3,
      tickInterval: skill.bleedTickInterval ?? 1,
      tickTimer: skill.bleedTickInterval ?? 1,
    });
    this.pushStatusEvent(attacker, target, '出血', 'apply');
  }

  private useHeal(target: Combatant, skill: SkillDefinition): void {
    if ((target.skillCooldowns.heal ?? 0) > 0 || target.mp < (skill.mpCost ?? 0)) return;
    target.mp = Math.max(0, target.mp - (skill.mpCost ?? 0));
    target.skillCooldowns.heal = skill.cooldown;
    this.statusEffects.push({
      id: this.nextEffectId++,
      statusId: 'healing',
      name: '治療術',
      sourceId: target.id,
      targetId: target.id,
      amountPerTick: Math.max(1, Math.round(target.maxHp * (skill.healPerSecondRatio ?? 0))),
      effectType: 'heal',
      remaining: skill.healDuration ?? 16,
      tickInterval: skill.healTickInterval ?? 1,
      tickTimer: skill.healTickInterval ?? 1,
    });
    this.pushStatusEvent(target, target, '治療術', 'apply');
  }

  private useItem(target: Combatant, itemId: ItemId, slotIndex: number): void {
    const item = itemById(itemId);
    target.itemUsed[slotIndex] = true;
    const heal = Math.max(1, Math.round(target.maxHp * item.healHpRatio));
    const applied = Math.max(0, Math.min(heal, target.maxHp - target.hp));
    target.hp = Math.min(target.maxHp, target.hp + heal);
    this.addDamageText(target.position, applied, { color: 0x6fbf73, yOffset: -48, prefix: '+' });
    this.pushResourceEvent(target, target, 'hp', applied, item.name);
  }

  private tickStatusEffects(dt: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.statusEffects[i];
      const target = this.combatantById(effect.targetId);
      const source = this.combatantById(effect.sourceId) ?? target;
      if (!target || target.hp <= 0 || !source) {
        this.statusEffects.splice(i, 1);
        continue;
      }
      effect.tickTimer -= dt;
      while (effect.tickTimer <= 0 && target.hp > 0) {
        effect.tickTimer += effect.tickInterval;
        target.flash = 0.18;
        if (effect.effectType === 'damage') {
          target.hp = Math.max(0, target.hp - effect.amountPerTick);
          this.addDamageText(target.position, effect.amountPerTick, { color: 0xff5f5a, yOffset: -42, prefix: '-' });
          this.pushDamageEvent(source, target, '命中', effect.amountPerTick, undefined, effect.name);
          if (target.hp <= 0) this.pushDeathEvent(source, target);
        } else {
          const applied = Math.max(0, Math.min(effect.amountPerTick, target.maxHp - target.hp));
          target.hp = Math.min(target.maxHp, target.hp + effect.amountPerTick);
          this.addDamageText(target.position, applied, { color: 0x6fbf73, yOffset: -48, prefix: '+' });
          this.pushResourceEvent(source, target, 'hp', applied, effect.name);
        }
      }
      effect.remaining -= dt;
      if (effect.remaining <= 0 || target.hp <= 0) {
        if (target.hp > 0) this.pushStatusEvent(source, target, effect.name, 'expire');
        this.statusEffects.splice(i, 1);
      }
    }
  }

  private resolveBasicAttackWithWeapon(attacker: Combatant, target: Combatant, weapon?: WeaponDefinition, hand?: CombatHandSide): number {
    return this.resolveAttackWithWeapon(attacker, target, weapon, hand, 1, '普攻');
  }

  private resolveAttackWithWeapon(attacker: Combatant, target: Combatant, weapon: WeaponDefinition | undefined, hand: CombatHandSide | undefined, damageMultiplier: number, actionName: string): number {
    const table = buildAttackTable({
      attacker: attacker.attrs,
      defender: target.attrs,
      defenderParryRate: target.parryRate,
      defenderBlockRate: target.blockRate,
      attackerCanCrit: weapon?.kind !== '槍',
      attackerCrushRate: 0,
      canBeParried: weapon?.attackMode !== 'projectile',
      canBeBlocked: true,
    });
    const outcome = rollOutcome(table, this.rng);
    const base = baseDamageWithWeapon(attacker, this.rng, weapon);
    const result = resolveDamage(outcome, base, { armor: target.armor, reductionRate: target.reductionRate }, damageMultiplier);
    const damage = result.damage;

    if (damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp > 0 && target.faction !== 'player') {
        if (target.faction === 'neutral') target.retaliationTargetId = attacker.id;
        if (this.canAttack(target, attacker)) target.aiState = 'combat';
      }
      this.pushDamageEvent(attacker, target, outcome, damage, hand, actionName);
      if (target.hp <= 0) this.pushDeathEvent(attacker, target);
    } else {
      this.pushMissEvent(attacker, target, outcome, hand, actionName);
    }
    return damage;
  }

  private definitionFor(enemy: Combatant): EnemyDefinition {
    if (!enemy.definitionId) throw new Error(`${enemy.name} does not have an enemy definition`);
    return enemyById(enemy.definitionId);
  }

  private weaponById(attacker: Combatant, weaponId: string): WeaponDefinition | undefined {
    return attacker.hands.find((hand) => hand.weapon.id === weaponId)?.weapon;
  }

  private hasReadyHand(combatant: Combatant): boolean {
    return combatant.hands.some((hand) => hand.cooldown === 0);
  }

  private hasProjectileAttack(combatant: Combatant): boolean {
    return combatant.hands.some((hand) => hand.weapon.attackMode === 'projectile');
  }

  private maxAttackRange(combatant: Combatant): number {
    if (combatant.hands.length === 0) return BASIC_RANGE;
    return Math.max(...combatant.hands.map((hand) => hand.weapon.range));
  }

  private projectileHitsObstacle(projectile: Projectile): boolean {
    return this.obstacles.some((obstacle) => {
      const halfWidth = obstacle.width / 2;
      const halfHeight = obstacle.height / 2;
      const closestX = Math.max(obstacle.position.x - halfWidth, Math.min(projectile.position.x, obstacle.position.x + halfWidth));
      const closestY = Math.max(obstacle.position.y - halfHeight, Math.min(projectile.position.y, obstacle.position.y + halfHeight));
      return distance(projectile.position, { x: closestX, y: closestY }) <= projectile.radius;
    });
  }

  private hasLineOfSight(from: Vec2, to: Vec2): boolean {
    return !this.obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
  }

  private combatants(): Combatant[] {
    return [this.player, ...this.enemies, ...this.allies, ...this.neutrals];
  }

  private npcCombatants(): Combatant[] {
    return [...this.enemies, ...this.allies, ...this.neutrals];
  }

  private combatantById(id: number): Combatant | undefined {
    return this.combatants().find((combatant) => combatant.id === id);
  }

  private canAttack(attacker: Combatant, target: Combatant): boolean {
    if (attacker.id === target.id || attacker.hp <= 0 || target.hp <= 0) return false;
    if (attacker.faction === 'player') return target.faction === 'enemy';
    if (attacker.faction === 'enemy') return target.faction === 'player' || target.faction === 'ally' || target.faction === 'neutral';
    if (attacker.faction === 'ally') return target.faction === 'enemy';
    if (attacker.faction === 'neutral') return target.id === attacker.retaliationTargetId;
    return false;
  }

  private attackableTargetsFor(attacker: Combatant): Combatant[] {
    return this.combatants().filter((target) => this.canAttack(attacker, target));
  }

  private targetFor(attacker: Combatant): Combatant | null {
    const targets = this.attackableTargetsFor(attacker);
    if (attacker.faction === 'neutral') {
      const target = targets.find((candidate) => candidate.id === attacker.retaliationTargetId) ?? null;
      if (!target) attacker.retaliationTargetId = undefined;
      return target;
    }
    let nearest: Combatant | null = null;
    let nearestDistance = Infinity;
    for (const target of targets) {
      const d = distance(attacker.position, target.position);
      if (d < nearestDistance) {
        nearest = target;
        nearestDistance = d;
      }
    }
    return nearest;
  }

  private alertTargetFor(attacker: Combatant): Combatant | null {
    if (attacker.faction === 'neutral' && !attacker.retaliationTargetId) return null;
    const targets = this.attackableTargetsFor(attacker).filter(
      (target) => distance(attacker.homePosition, target.position) <= attacker.alertRange,
    );
    if (attacker.faction === 'neutral') {
      return targets.find((candidate) => candidate.id === attacker.retaliationTargetId) ?? null;
    }
    let nearest: Combatant | null = null;
    let nearestDistance = Infinity;
    for (const target of targets) {
      const d = distance(attacker.position, target.position);
      if (d < nearestDistance) {
        nearest = target;
        nearestDistance = d;
      }
    }
    return nearest;
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
      side: combatant.faction,
      name: combatant.name,
    };
  }

  private pushDamageEvent(attacker: Combatant, target: Combatant, outcome: AttackOutcome, damage: number, hand?: CombatHandSide, actionName = '普攻'): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'damage',
      source: this.actorRef(attacker),
      target: this.actorRef(target),
      action: { kind: 'basicAttack', name: actionName },
      amount: damage,
      outcome,
      hand,
    });
  }

  private pushMissEvent(attacker: Combatant, target: Combatant, outcome: AttackOutcome, hand?: CombatHandSide, actionName = '普攻'): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'miss',
      source: this.actorRef(attacker),
      target: this.actorRef(target),
      action: { kind: 'basicAttack', name: actionName },
      outcome,
      hand,
    });
  }

  private pushStatusEvent(source: Combatant, target: Combatant, statusName: string, statusAction: 'apply' | 'expire' | 'resist'): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'status',
      source: this.actorRef(source),
      target: this.actorRef(target),
      statusName,
      statusAction,
    });
  }

  private pushResourceEvent(source: Combatant, target: Combatant, resource: 'hp' | 'mp', amount: number, actionName: string): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'resource',
      source: this.actorRef(source),
      target: this.actorRef(target),
      action: { kind: 'basicAttack', name: actionName },
      resource,
      amount,
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
