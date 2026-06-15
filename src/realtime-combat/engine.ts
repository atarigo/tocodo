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
import { statusById } from './statusCatalog.js';
import type { AiState, ArenaObstacle, Attributes, BattleResult, BattleSetup, CombatActorRef, CombatEvent, CombatFaction, CombatHand, CombatHandSide, Combatant, DamageText, EnemyDefinition, EnemySpawn, Impact, InputState, ItemId, Projectile, SkillFailureReason, SkillId, StatusEffect, Strike, Vec2, WeaponDefinition } from './types.js';
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
const NPC_RESET_REGEN_INTERVAL = 1;
const NPC_RESET_REGEN_DURATION = 2;
const NPC_RESET_REGEN_RATIO = 0.5;
const PLAYER_COMBAT_TIMEOUT = 5;
const PLAYER_IDLE_HP_REGEN_INTERVAL = 1;
const PLAYER_IDLE_HP_REGEN_RATIO = 0.01;
const PLAYER_IDLE_MP_REGEN_INTERVAL = 30;
const PLAYER_IDLE_MP_REGEN_RATIO = 0.002;
const TERRAIN_COLLISION_CATEGORY = 0x0001;
const COMBATANT_COLLISION_CATEGORY = 0x0002;

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
  private playerCombatTimer = 0;
  private playerIdleHpRegenTimer = 0;
  private playerIdleMpRegenTimer = 0;
  private readonly npcResetRegenTimers = new Map<number, number>();

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
      aiState: 'guard',
      defaultAiState: 'guard',
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
    const skill = skillById(skillId);
    const target = skill.targetType === 'self' ? this.player : this.targetFor(this.player);
    if (!target) {
      this.pushActionFailEvent(this.player, skill.name, 'noTarget');
      return;
    }
    const failureReason = this.skillFailureReason(this.player, target, skill);
    if (failureReason) {
      this.pushActionFailEvent(this.player, skill.name, failureReason);
      return;
    }
    this.useSkill(this.player, target, skill);
  }

  playerSkillFailureReason(slotIndex: number): SkillFailureReason | null {
    const skillId = this.player.skillSlots[slotIndex];
    if (!skillId || this.result || this.player.hp <= 0) return null;
    const skill = skillById(skillId);
    const target = skill.targetType === 'self' ? this.player : this.targetFor(this.player);
    if (!target) return 'noTarget';
    return this.skillFailureReason(this.player, target, skill);
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
      this.removeDeadBodies();
    } else {
      this.stopBodies();
    }
    Matter.Engine.update(this.matter, safeDt * 1000);
    this.syncPositions();
    if (!this.result) this.tickProjectiles(safeDt);
    else this.projectiles.length = 0;
    if (!this.result) this.tickStatusEffects(safeDt);
    if (!this.result) this.removeDeadBodies();
    if (!this.result) this.tickPlayerCombatState(safeDt);
    if (!this.result) this.tickHiddenPassiveRegen(safeDt);
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
      collisionFilter: {
        category: COMBATANT_COLLISION_CATEGORY,
        mask: TERRAIN_COLLISION_CATEGORY,
      },
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
    if (input.attacking && this.player.hp > 0) {
      this.performReadyAttacks(this.player, this.attackableTargetsFor(this.player));
    }
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
      this.enterCombat(actor);
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
      actor.combatOrigin = undefined;
      this.startNpcResetRegen(actor);
      this.setVelocity(actor, { x: 0, y: 0 });
      return;
    }
    const dir = this.steeredDirectionToPoint(actor, actor.homePosition, normalize(toHome));
    actor.facing = Math.atan2(dir.y, dir.x);
    this.setVelocity(actor, { x: dir.x * actor.speed, y: dir.y * actor.speed });
  }

  private updateCombatState(actor: Combatant): void {
    if (distance(actor.position, actor.combatOrigin ?? actor.homePosition) > actor.leashRange) {
      actor.aiState = 'returning';
      this.clearNpcResetRegen(actor);
      return;
    }

    const target = this.targetFor(actor);
    if (!target) {
      actor.aiState = 'returning';
      this.clearNpcResetRegen(actor);
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
      const hasShot = this.hasLineOfSight(actor.position, target.position);
      const desired = shouldMove ? { x: dir.x * moveSign, y: dir.y * moveSign } : hasShot ? { x: 0, y: 0 } : this.sideStepDirection(actor, target);
      const movement = this.steeredDirection(actor, target, desired);
      this.setVelocity(actor, { x: movement.x * actor.speed, y: movement.y * actor.speed });
      if (hasShot && d <= this.maxAttackRange(actor) && this.hasReadyHand(actor)) this.performReadyAttacks(actor, this.attackableTargetsFor(actor));
    } else {
      const holdDistance = this.maxAttackRange(actor) + target.radius - 8;
      const desired = d > holdDistance ? dir : { x: 0, y: 0 };
      const movement = this.steeredDirection(actor, target, desired);
      this.setVelocity(actor, { x: movement.x * actor.speed, y: movement.y * actor.speed });
      if (d <= this.maxAttackRange(actor) + target.radius && this.hasReadyHand(actor)) this.performReadyAttacks(actor, this.attackableTargetsFor(actor));
    }

    if (distance(actor.position, target.position) <= actor.radius + target.radius + 2) {
      this.addImpact({
        x: (actor.position.x + target.position.x) / 2,
        y: (actor.position.y + target.position.y) / 2,
      });
    }
  }

  private enterCombat(actor: Combatant): void {
    if (actor.faction === 'player') return;
    if (actor.aiState !== 'combat') actor.combatOrigin = { ...actor.position };
    actor.aiState = 'combat';
    this.clearNpcResetRegen(actor);
  }

  private steeredDirection(actor: Combatant, target: Combatant, desired: Vec2): Vec2 {
    return this.steeredDirectionToPoint(actor, target.position, desired, this.hasLineOfSight(actor.position, target.position));
  }

  private steeredDirectionToPoint(actor: Combatant, targetPosition: Vec2, desired: Vec2, hasLineOfSight = this.hasLineOfSight(actor.position, targetPosition)): Vec2 {
    const base = normalize(desired);
    if (base.x === 0 && base.y === 0) return base;
    if (!this.movementBlocked(actor, base) && hasLineOfSight) return base;

    const left = normalize({ x: -base.y + base.x * 0.35, y: base.x + base.y * 0.35 });
    const right = normalize({ x: base.y + base.x * 0.35, y: -base.x + base.y * 0.35 });
    const candidates = [left, right, base].filter((candidate) => !this.movementBlocked(actor, candidate));
    if (candidates.length === 0) return base;

    let best = candidates[0];
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const projected = {
        x: actor.position.x + candidate.x * actor.speed * 0.45,
        y: actor.position.y + candidate.y * actor.speed * 0.45,
      };
      const d = distance(projected, targetPosition);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    return best;
  }

  private sideStepDirection(actor: Combatant, target: Combatant): Vec2 {
    const toTarget = normalize({
      x: target.position.x - actor.position.x,
      y: target.position.y - actor.position.y,
    });
    const left = { x: -toTarget.y, y: toTarget.x };
    const right = { x: toTarget.y, y: -toTarget.x };
    if (this.movementBlocked(actor, left)) return right;
    if (this.movementBlocked(actor, right)) return left;
    return this.rng() < 0.5 ? left : right;
  }

  private movementBlocked(actor: Combatant, direction: Vec2): boolean {
    const lookAhead = actor.radius + Math.max(36, actor.speed * 0.35);
    const from = actor.position;
    const to = {
      x: actor.position.x + direction.x * lookAhead,
      y: actor.position.y + direction.y * lookAhead,
    };
    return this.obstacles.some((obstacle) => segmentIntersectsRect(from, to, obstacle));
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

  private removeDeadBodies(): void {
    for (const combatant of this.combatants()) {
      if (combatant.hp > 0 || combatant.bodyId === null) continue;
      const body = this.bodies.get(combatant.id);
      if (!body) continue;
      Matter.Composite.remove(this.matter.world, body);
      this.bodies.delete(combatant.id);
      combatant.bodyId = null;
      this.clearNpcResetRegen(combatant);
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
    for (const skillId of attacker.skills) {
      const skill = skillById(skillId);
      if (this.skillFailureReason(attacker, target, skill, distanceToTarget)) continue;
      this.useSkill(attacker, target, skill);
      return true;
    }
    return false;
  }

  private skillFailureReason(attacker: Combatant, target: Combatant, skill: SkillDefinition, distanceToTarget = distance(attacker.position, target.position)): SkillFailureReason | null {
    if ((attacker.skillCooldowns[skill.id] ?? 0) > 0) return 'cooldown';
    if (attacker.mp < (skill.mpCost ?? 0)) return 'notEnoughMp';
    if (skill.targetType === 'self' && attacker.id !== target.id) return 'noTarget';
    if (skill.targetType === 'enemy' && !this.canAttack(attacker, target)) return 'noTarget';
    if (distanceToTarget < (skill.minRange ?? 0)) return 'tooClose';
    if (distanceToTarget > (skill.maxRange ?? Infinity)) return 'tooFar';
    const meleeHand = this.meleeHandFor(attacker);
    if (skill.requiresMeleeRange && (!meleeHand || !targetInMeleeRange(attacker, target, meleeHand))) return 'notInMeleeRange';
    if (skill.requiresLineOfSight && !this.hasLineOfSight(attacker.position, target.position)) return 'blocked';
    return null;
  }

  private useSkill(attacker: Combatant, target: Combatant, skill: SkillDefinition): void {
    if (this.skillFailureReason(attacker, target, skill)) return;
    if (attacker.faction === 'player') this.markPlayerInCombat();
    attacker.mp = Math.max(0, attacker.mp - (skill.mpCost ?? 0));
    attacker.skillCooldowns[skill.id] = skill.cooldown;

    let lastDamage = 0;
    for (const effect of skill.effects) {
      if (effect.kind === 'moveToTarget') {
        this.moveNearTarget(attacker, target, effect.stopDistanceBonus);
        continue;
      }
      if (effect.kind === 'damage') {
        const hand = this.meleeHandFor(attacker) ?? attacker.hands[0];
        lastDamage = this.resolveAttackWithWeapon(attacker, target, hand?.weapon, hand?.side, effect.multiplier, skill.name);
        if (lastDamage > 0) {
          target.flash = 0.22;
          this.addImpact(target.position);
          this.addDamageText(target.position, lastDamage);
        }
        continue;
      }
      if (effect.kind === 'applyStatus') {
        if (this.rng() >= effect.chance) continue;
        if (effect.amount.kind === 'damageRatio' && lastDamage <= 0) continue;
        const amountPerTick = effect.amount.kind === 'damageRatio' ? Math.max(1, Math.round(lastDamage * effect.amount.ratio)) : Math.max(1, Math.round(target.maxHp * effect.amount.ratio));
        if (amountPerTick > 0) this.applyStatus(attacker, target, effect.statusId, amountPerTick, effect.duration);
      }
    }
  }

  private moveNearTarget(attacker: Combatant, target: Combatant, stopDistanceBonus: number): void {
    const dir = normalize({
      x: attacker.position.x - target.position.x,
      y: attacker.position.y - target.position.y,
    });
    const stopDistance = attacker.radius + target.radius + stopDistanceBonus;
    this.moveBodyTo(attacker, {
      x: target.position.x + dir.x * stopDistance,
      y: target.position.y + dir.y * stopDistance,
    });
    attacker.facing = angleTo(attacker.position, target.position);
  }

  private applyStatus(source: Combatant, target: Combatant, statusId: StatusEffect['statusId'], amountPerTick: number, duration: number): void {
    const status = statusById(statusId);
    const existingIndex = this.statusEffects.findIndex((effect) => effect.statusId === statusId && effect.sourceId === source.id && effect.targetId === target.id);
    if (existingIndex >= 0 && status.stackRule === 'refresh') {
      const existing = this.statusEffects[existingIndex];
      existing.amountPerTick = amountPerTick;
      existing.remaining = duration;
      existing.tickInterval = status.tickInterval;
      existing.tickTimer = status.tickInterval;
      this.pushStatusEvent(source, target, status.name, 'apply');
      return;
    }
    if (existingIndex >= 0 && status.stackRule === 'replace') {
      this.statusEffects.splice(existingIndex, 1);
    }
    this.statusEffects.push({
      id: this.nextEffectId++,
      statusId,
      name: status.name,
      kind: status.kind,
      stackRule: status.stackRule,
      sourceId: source.id,
      targetId: target.id,
      amountPerTick,
      effectType: status.effectType,
      remaining: duration,
      tickInterval: status.tickInterval,
      tickTimer: status.tickInterval,
    });
    this.pushStatusEvent(source, target, status.name, 'apply');
  }

  private useItem(target: Combatant, itemId: ItemId, slotIndex: number): void {
    const item = itemById(itemId);
    target.itemUsed[slotIndex] = true;
    for (const effect of item.effects) {
      if (effect.kind !== 'heal' || effect.resource !== 'hp') continue;
      const heal = Math.max(1, Math.round(target.maxHp * effect.ratio));
      const applied = Math.max(0, Math.min(heal, target.maxHp - target.hp));
      target.hp = Math.min(target.maxHp, target.hp + heal);
      this.addDamageText(target.position, applied, { color: 0x6fbf73, yOffset: -48, prefix: '+' });
      this.pushResourceEvent(target, target, 'hp', applied, item.name);
    }
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
          if (source.faction === 'player' || target.faction === 'player') this.markPlayerInCombat();
          target.hp = Math.max(0, target.hp - effect.amountPerTick);
          if (target.hp > 0 && target.faction !== 'player' && this.canAttack(target, source)) {
            this.enterCombat(target);
          }
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

  private tickHiddenPassiveRegen(dt: number): void {
    this.tickNpcResetRegen(dt);
    this.tickPlayerIdleRegen(dt);
  }

  private tickNpcResetRegen(dt: number): void {
    for (const actor of this.npcCombatants()) {
      if (actor.hp <= 0) {
        this.clearNpcResetRegen(actor);
        continue;
      }
      const elapsed = this.npcResetRegenTimers.get(actor.id);
      if (elapsed === undefined) continue;
      if (actor.aiState !== 'guard' && actor.aiState !== 'patrol') {
        this.clearNpcResetRegen(actor);
        continue;
      }

      const nextElapsed = elapsed + dt;
      const previousTicks = Math.floor(elapsed / NPC_RESET_REGEN_INTERVAL);
      const nextTicks = Math.floor(Math.min(nextElapsed, NPC_RESET_REGEN_DURATION) / NPC_RESET_REGEN_INTERVAL);
      const ticks = Math.max(0, nextTicks - previousTicks);
      if (ticks > 0) this.restoreHiddenResource(actor, actor.maxHp * NPC_RESET_REGEN_RATIO * ticks, actor.maxMp * NPC_RESET_REGEN_RATIO * ticks);

      if (nextElapsed >= NPC_RESET_REGEN_DURATION) {
        this.clearNpcResetRegen(actor);
      } else {
        this.npcResetRegenTimers.set(actor.id, nextElapsed);
      }
    }
  }

  private tickPlayerIdleRegen(dt: number): void {
    if (this.player.hp <= 0 || this.player.aiState === 'combat') {
      this.playerIdleHpRegenTimer = 0;
      this.playerIdleMpRegenTimer = 0;
      return;
    }

    this.playerIdleHpRegenTimer += dt;
    if (this.playerIdleHpRegenTimer >= PLAYER_IDLE_HP_REGEN_INTERVAL) {
      const ticks = Math.floor(this.playerIdleHpRegenTimer / PLAYER_IDLE_HP_REGEN_INTERVAL);
      this.playerIdleHpRegenTimer -= ticks * PLAYER_IDLE_HP_REGEN_INTERVAL;
      this.restoreHiddenResource(this.player, this.player.maxHp * PLAYER_IDLE_HP_REGEN_RATIO * ticks, 0);
    }

    this.playerIdleMpRegenTimer += dt;
    if (this.playerIdleMpRegenTimer >= PLAYER_IDLE_MP_REGEN_INTERVAL) {
      const ticks = Math.floor(this.playerIdleMpRegenTimer / PLAYER_IDLE_MP_REGEN_INTERVAL);
      this.playerIdleMpRegenTimer -= ticks * PLAYER_IDLE_MP_REGEN_INTERVAL;
      this.restoreHiddenResource(this.player, 0, this.player.maxMp * PLAYER_IDLE_MP_REGEN_RATIO * ticks);
    }
  }

  private restoreHiddenResource(target: Combatant, hpAmount: number, mpAmount: number): void {
    if (hpAmount > 0) target.hp = Math.min(target.maxHp, target.hp + hpAmount);
    if (mpAmount > 0) target.mp = Math.min(target.maxMp, target.mp + mpAmount);
  }

  private tickPlayerCombatState(dt: number): void {
    if (this.player.aiState !== 'combat') return;
    this.playerCombatTimer = Math.max(0, this.playerCombatTimer - dt);
    if (this.playerCombatTimer <= 0) {
      this.player.aiState = 'guard';
    }
  }

  private markPlayerInCombat(): void {
    if (this.player.hp <= 0) return;
    this.player.aiState = 'combat';
    this.playerCombatTimer = PLAYER_COMBAT_TIMEOUT;
  }

  private startNpcResetRegen(actor: Combatant): void {
    if (actor.faction === 'player' || actor.hp <= 0) return;
    this.npcResetRegenTimers.set(actor.id, 0);
  }

  private clearNpcResetRegen(actor: Combatant): void {
    this.npcResetRegenTimers.delete(actor.id);
  }

  private resolveBasicAttackWithWeapon(attacker: Combatant, target: Combatant, weapon?: WeaponDefinition, hand?: CombatHandSide): number {
    return this.resolveAttackWithWeapon(attacker, target, weapon, hand, 1, '普攻');
  }

  private resolveAttackWithWeapon(attacker: Combatant, target: Combatant, weapon: WeaponDefinition | undefined, hand: CombatHandSide | undefined, damageMultiplier: number, actionName: string): number {
    if (attacker.faction === 'player' || target.faction === 'player') this.markPlayerInCombat();
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
        if (this.canAttack(target, attacker)) this.enterCombat(target);
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

  private meleeHandFor(combatant: Combatant): CombatHand | undefined {
    return combatant.hands.find((hand) => hand.weapon.attackMode === 'melee');
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

  private pushActionFailEvent(source: Combatant, actionName: string, reason: SkillFailureReason): void {
    this.onEvent?.({
      id: this.nextLogId++,
      kind: 'actionFail',
      source: this.actorRef(source),
      action: { kind: 'basicAttack', name: actionName },
      reason,
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
