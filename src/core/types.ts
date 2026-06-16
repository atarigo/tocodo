export interface Vec2 {
  x: number;
  y: number;
}

export type CombatantKind = 'player' | 'meleeEnemy' | 'rangedEnemy';
export type CombatFaction = 'player' | 'enemy' | 'ally' | 'neutral';
export type AiState = 'guard' | 'patrol' | 'combat' | 'returning';
export type WeaponKind = '近戰' | '槍' | '弓' | '法杖';
export type AttackMode = 'melee' | 'projectile';
export type AmmoType = 'arrow' | 'bullet';
export type Rank = 'D' | 'C' | 'B' | 'A' | 'S';

export const RANKS: Rank[] = ['D', 'C', 'B', 'A', 'S'];

export const RANK_LABELS: Record<Rank, string> = {
  D: 'D 級',
  C: 'C 級',
  B: 'B 級',
  A: 'A 級',
  S: 'S 級',
};

export const RANK_BASE_PRICE: Record<Rank, number> = {
  D: 4_000,
  C: 15_000,
  B: 50_000,
  A: 150_000,
  S: 550_000,
};
export type SkillId = 'charge' | 'bite' | 'heal';
export type ItemId = 'smallHealthPotion';
export type StatusId = 'bleed' | 'healing';
export type StatusKind = 'buff' | 'debuff';
export type StatusStackRule = 'stack' | 'refresh' | 'replace';
export type EquipmentSlot = 'mainHand' | 'offHand' | 'head' | 'body' | 'legs' | 'feet';
export type EquipmentLoadout = Record<EquipmentSlot, string | null>;
export interface ActionLoadout {
  skillSlots: (SkillId | null)[];
  itemSlots: (ItemId | null)[];
}

export interface ActionBarState {
  skillCooldowns: number[];
  skillFailureReasons: (SkillFailureReason | null)[];
  itemUsed: boolean[];
}

export interface CombatStageSnapshot {
  elapsed: number;
  enemyAliveCount: number;
}

/** 六主屬性：範圍 0〜255、起始 10；沒有預設數值，基本狀態全由屬性或裝備提供 */
export interface Attributes {
  str: number; // 力量：傷害固定值直加
  vit: number; // 體質：生命 ×10
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

export const ATTR_KEYS: (keyof Attributes)[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];

export interface DefenseStats {
  armor: number;
  reductionRate: number;
  parryRate: number;
  blockRate: number;
}

export interface Combatant {
  id: number;
  kind: CombatantKind;
  faction: CombatFaction;
  definitionId?: string;
  name: string;
  attrs: Attributes;
  radius: number;
  color: number;
  position: Vec2;
  homePosition: Vec2;
  combatOrigin?: Vec2;
  facing: number;
  speed: number;
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
  hands: CombatHand[];
  skills: SkillId[];
  skillSlots: (SkillId | null)[];
  skillCooldowns: Partial<Record<SkillId, number>>;
  itemSlots: (ItemId | null)[];
  itemUsed: boolean[];
  aiState: AiState;
  defaultAiState: AiState;
  alertRange: number;
  leashRange: number;
  retaliationTargetId?: number;
}

export type CombatHandSide = 'main' | 'off';

export interface CombatHand {
  side: CombatHandSide;
  weapon: WeaponDefinition;
  cooldown: number;
  interval: number;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  rank: Rank;
  price?: number;
  slot: 'mainHand' | 'offHand';
  twoHanded: boolean;
  kind: WeaponKind;
  attackMode: AttackMode;
  damage: [number, number];
  balance: number;
  interval: number;
  range: number;
  arc: number;
  strApplies: boolean;
  agiApplies: boolean;
  dexAmp: boolean;
  parryRate: number;
  blockRate?: number;
  projectile?: {
    ammoType: AmmoType;
    shotsPerAttack: number;
    spreadAngle: number;
  };
}

export interface AmmoDefinition {
  id: string;
  name: string;
  ammoType: AmmoType;
  speed: number;
  range: number;
  radius: number;
  quantity: number;
}

export interface GearDefinition {
  id: string;
  name: string;
  rank: Rank;
  price?: number;
  slot: Exclude<EquipmentSlot, 'mainHand'>;
  armor: number;
  reductionRate: number;
  parryRate: number;
  blockRate: number;
}

export type EquipmentDefinition = WeaponDefinition | GearDefinition;

export interface EnemyDefinition {
  id: string;
  name: string;
  kind: Exclude<CombatantKind, 'player'>;
  attrs: Attributes;
  radius: number;
  color: number;
  speed: number;
  preferredRange?: number;
  aiState?: AiState;
  alertRange?: number;
  leashRange?: number;
  skills?: SkillId[];
  armor: number;
  reductionRate: number;
  parryRate: number;
  blockRate: number;
  loadout: EquipmentLoadout;
}

export interface EnemySpawn {
  enemyId: string;
  position: Vec2;
  facing?: number;
  name?: string;
  attrs?: Attributes;
  aiState?: AiState;
  alertRange?: number;
  leashRange?: number;
}

export interface ArenaObstacle {
  id: number;
  position: Vec2;
  width: number;
  height: number;
}

export interface BattleSetup {
  difficulty?: Rank;
  encounterName?: string;
  player: {
    name: string;
    attrs: Attributes;
    loadout: EquipmentLoadout;
    actionLoadout: ActionLoadout;
    position: Vec2;
    facing: number;
  };
  enemies: EnemySpawn[];
  allies?: EnemySpawn[];
  neutrals?: EnemySpawn[];
  obstacles?: ArenaObstacle[];
}

export interface Projectile {
  id: number;
  ownerId: number;
  weaponId: string;
  hand: CombatHandSide;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
  distanceLeft: number;
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
  color?: number;
}

export interface StatusEffect {
  id: number;
  statusId: StatusId;
  name: string;
  kind: StatusKind;
  stackRule: StatusStackRule;
  sourceId: number;
  targetId: number;
  amountPerTick: number;
  effectType: 'damage' | 'heal';
  remaining: number;
  tickInterval: number;
  tickTimer: number;
}

export type CombatSide = CombatFaction;
export type CombatActionKind = 'basicAttack';
export type SkillFailureReason = 'cooldown' | 'notEnoughMp' | 'noTarget' | 'tooClose' | 'tooFar' | 'notInMeleeRange' | 'blocked';
export type CombatEventKind = 'damage' | 'miss' | 'status' | 'resource' | 'actionFail' | 'death' | 'battleEnd';
export type BattleResult = 'playerWon' | 'playerLost';

export interface CombatActorRef {
  id: number;
  side: CombatSide;
  name: string;
}

export interface CombatActionRef {
  kind: CombatActionKind;
  name: string;
}

interface CombatEventBase {
  id: number;
  kind: CombatEventKind;
  source: CombatActorRef;
  action?: CombatActionRef;
}

export interface DamageEvent extends CombatEventBase {
  kind: 'damage';
  target: CombatActorRef;
  amount: number;
  outcome: string;
  hand?: CombatHandSide;
}

export interface MissEvent extends CombatEventBase {
  kind: 'miss';
  target: CombatActorRef;
  outcome: string;
  hand?: CombatHandSide;
}

export interface StatusEvent extends CombatEventBase {
  kind: 'status';
  target: CombatActorRef;
  statusName: string;
  statusAction: 'apply' | 'expire' | 'resist';
}

export interface ResourceEvent extends CombatEventBase {
  kind: 'resource';
  target: CombatActorRef;
  resource: 'hp' | 'mp';
  amount: number;
}

export interface ActionFailEvent extends CombatEventBase {
  kind: 'actionFail';
  reason: SkillFailureReason;
}

export interface DeathEvent extends CombatEventBase {
  kind: 'death';
  target: CombatActorRef;
}

export interface BattleEndEvent extends CombatEventBase {
  kind: 'battleEnd';
  result: BattleResult;
}

export type CombatEvent = DamageEvent | MissEvent | StatusEvent | ResourceEvent | ActionFailEvent | DeathEvent | BattleEndEvent;

export interface InputState {
  move: Vec2;
  aim: Vec2;
  attacking: boolean;
}

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
