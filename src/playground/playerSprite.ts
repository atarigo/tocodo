import { Container, Graphics, Text } from 'pixi.js';
import { getEquipment, getOffhandWeapon, getWeapon, normalizeLoadout } from '../data/equipmentCatalog.js';
import type { CombatHand, CombatHandSide, EquipmentLoadout, Vec2, WeaponDefinition } from '../core/types.js';

export interface PlayerSpriteOptions {
  alpha?: number;
  elapsed: number;
  facing: number;
  flash?: number;
  hpRatio?: number;
  label?: string;
  loadout: EquipmentLoadout;
  moving?: boolean;
  mpRatio?: number;
  position: Vec2;
}

type WeaponVisualKind = 'blade' | 'dagger' | 'greatsword' | 'spear' | 'bow' | 'pistol' | 'rifle' | 'shield';

const BODY = 0x67c88a;
const BODY_SHADOW = 0x276944;
const TUNIC = 0x2f7f60;
const SKIN = 0xf0c38f;
const BOOT = 0x252932;
const OUTLINE = 0x11131a;
const METAL = 0xd8dde8;
const DARK_METAL = 0x6d7687;
const WOOD = 0x8b5d32;
const LEATHER = 0x6f4732;
const BOW = 0xc9934c;
const GUN = 0x303846;

function facingVector(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function sideVector(angle: number): Vec2 {
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

function weaponVisualKind(weapon: WeaponDefinition): WeaponVisualKind {
  if (weapon.id === 'dagger' || weapon.id === 'offhand-dagger') return 'dagger';
  if (weapon.id === 'greatsword') return 'greatsword';
  if (weapon.id === 'spear') return 'spear';
  if (weapon.id === 'hunting-bow') return 'bow';
  if (weapon.id === 'pistol' || weapon.id === 'revolver') return 'pistol';
  if (weapon.id === 'rifle') return 'rifle';
  return 'blade';
}

function weaponLine(g: Graphics, from: Vec2, to: Vec2, color: number, width: number, alpha = 1): void {
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
  g.stroke({ color, width, alpha, cap: 'round' });
}

function drawBlade(g: Graphics, origin: Vec2, dir: Vec2, side: Vec2, length: number, width: number): void {
  const hilt = { x: origin.x - dir.x * 5, y: origin.y - dir.y * 5 };
  const tip = { x: origin.x + dir.x * length, y: origin.y + dir.y * length };
  weaponLine(g, hilt, tip, METAL, width);
  weaponLine(g, { x: hilt.x - side.x * 7, y: hilt.y - side.y * 7 }, { x: hilt.x + side.x * 7, y: hilt.y + side.y * 7 }, DARK_METAL, 3);
}

function drawSpear(g: Graphics, origin: Vec2, dir: Vec2, side: Vec2): void {
  const butt = { x: origin.x - dir.x * 12, y: origin.y - dir.y * 12 };
  const tip = { x: origin.x + dir.x * 48, y: origin.y + dir.y * 48 };
  weaponLine(g, butt, tip, WOOD, 4);
  g.moveTo(tip.x, tip.y);
  g.lineTo(tip.x - dir.x * 12 + side.x * 5, tip.y - dir.y * 12 + side.y * 5);
  g.lineTo(tip.x - dir.x * 12 - side.x * 5, tip.y - dir.y * 12 - side.y * 5);
  g.closePath().fill({ color: METAL });
}

function drawBow(g: Graphics, origin: Vec2, dir: Vec2, side: Vec2): void {
  g.arc(origin.x, origin.y, 23, -1.1, 1.1);
  g.rotation = Math.atan2(dir.y, dir.x);
  g.stroke({ color: BOW, width: 4, cap: 'round' });
  g.rotation = 0;
  weaponLine(g, { x: origin.x + side.x * 20, y: origin.y + side.y * 20 }, { x: origin.x - side.x * 20, y: origin.y - side.y * 20 }, METAL, 1, 0.9);
  weaponLine(g, origin, { x: origin.x + dir.x * 26, y: origin.y + dir.y * 26 }, METAL, 2, 0.8);
}

function drawGun(g: Graphics, origin: Vec2, dir: Vec2, side: Vec2, long: boolean): void {
  const barrel = long ? 40 : 22;
  const grip = long ? 13 : 9;
  weaponLine(g, origin, { x: origin.x + dir.x * barrel, y: origin.y + dir.y * barrel }, GUN, long ? 7 : 6);
  weaponLine(g, { x: origin.x - dir.x * 3, y: origin.y - dir.y * 3 }, { x: origin.x - dir.x * 3 - side.x * grip, y: origin.y - dir.y * 3 - side.y * grip }, DARK_METAL, 5);
  g.circle(origin.x + dir.x * barrel, origin.y + dir.y * barrel, 3).fill({ color: 0x171a21 });
}

function drawShield(g: Graphics, origin: Vec2): void {
  g.roundRect(origin.x - 12, origin.y - 14, 24, 28, 6).fill({ color: 0x7d5538 });
  g.roundRect(origin.x - 12, origin.y - 14, 24, 28, 6).stroke({ color: 0xd4b06a, width: 2 });
}

function drawWeapon(g: Graphics, origin: Vec2, angle: number, visualKind: WeaponVisualKind, sideOffset = 1): void {
  const dir = facingVector(angle);
  const side = sideVector(angle);
  const hand = {
    x: origin.x + dir.x * 13 + side.x * sideOffset * 9,
    y: origin.y + dir.y * 13 + side.y * sideOffset * 9,
  };

  if (visualKind === 'dagger') drawBlade(g, hand, dir, side, 18, 4);
  else if (visualKind === 'greatsword') drawBlade(g, hand, dir, side, 45, 9);
  else if (visualKind === 'spear') drawSpear(g, hand, dir, side);
  else if (visualKind === 'bow') drawBow(g, hand, dir, side);
  else if (visualKind === 'pistol') drawGun(g, hand, dir, side, false);
  else if (visualKind === 'rifle') drawGun(g, hand, dir, side, true);
  else if (visualKind === 'shield') drawShield(g, hand);
  else drawBlade(g, hand, dir, side, 30, 6);
}

function drawBars(layer: Container, hpRatio: number, mpRatio: number): void {
  const g = new Graphics();
  g.roundRect(-34, -50, 68, 5, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
  g.roundRect(-34, -50, 68 * hpRatio, 5, 2).fill({ color: 0xe0564b });
  g.roundRect(-34, -42, 68, 4, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
  g.roundRect(-34, -42, 68 * mpRatio, 4, 2).fill({ color: 0x5b8def });
  layer.addChild(g);
}

function drawName(layer: Container, label: string): void {
  const name = new Text({
    text: label,
    style: {
      fill: 0xd8ffe3,
      fontFamily: 'Helvetica Neue, PingFang TC, Microsoft JhengHei, sans-serif',
      fontSize: 11,
    },
  });
  name.anchor.set(0.5, 1);
  name.position.set(0, -54);
  layer.addChild(name);
}

export function drawPlayerSprite(layer: Container, options: PlayerSpriteOptions): void {
  const normalized = normalizeLoadout(options.loadout);
  const mainWeapon = getWeapon(normalized);
  const offhandWeapon = getOffhandWeapon(normalized);
  const offhandItem = normalized.offHand ? getEquipment(normalized.offHand) : null;
  const holder = new Container();
  const g = new Graphics();
  const flashAlpha = options.flash && options.flash > 0 ? 0.35 + Math.sin(options.flash * 80) * 0.25 : 0;
  const stride = options.moving ? Math.sin(options.elapsed * 14) * 4 : Math.sin(options.elapsed * 4) * 1.2;
  const dir = facingVector(options.facing);
  const side = sideVector(options.facing);
  const skin = options.flash && options.flash > 0 ? 0xffffff : SKIN;
  const body = options.flash && options.flash > 0 ? 0xffffff : BODY;

  holder.position.set(options.position.x, options.position.y);
  holder.alpha = options.alpha ?? 1;
  layer.addChild(holder);

  if (options.hpRatio !== undefined || options.mpRatio !== undefined) drawBars(holder, options.hpRatio ?? 1, options.mpRatio ?? 1);

  drawWeapon(g, { x: 0, y: 0 }, options.facing, weaponVisualKind(mainWeapon), 1);
  if (offhandWeapon) drawWeapon(g, { x: 0, y: 0 }, options.facing, weaponVisualKind(offhandWeapon), -1);
  else if (offhandItem?.id === 'wooden-shield') drawWeapon(g, { x: 0, y: 0 }, options.facing, 'shield', -1);

  g.ellipse(-side.x * 7 + dir.x * 1, -side.y * 7 + dir.y * 1 + 18 + stride, 6, 11).fill({ color: BOOT });
  g.ellipse(side.x * 7 + dir.x * 1, side.y * 7 + dir.y * 1 + 18 - stride, 6, 11).fill({ color: BOOT });
  g.circle(0, 2, 19).fill({ color: body });
  g.circle(0, 2, 19).stroke({ color: OUTLINE, width: 3, alpha: 0.82 });
  g.roundRect(-12, -6, 24, 18, 5).fill({ color: TUNIC, alpha: 0.8 });
  g.circle(dir.x * 9 - side.x * 8, dir.y * 9 - side.y * 8, 6).fill({ color: skin });
  g.circle(dir.x * 9 + side.x * 8, dir.y * 9 + side.y * 8, 6).fill({ color: skin });
  g.circle(dir.x * 8, dir.y * 8 - 11, 12).fill({ color: skin });
  g.circle(dir.x * 8, dir.y * 8 - 11, 12).stroke({ color: OUTLINE, width: 2, alpha: 0.72 });
  g.circle(dir.x * 12 + side.x * 4, dir.y * 12 + side.y * 4 - 12, 2).fill({ color: OUTLINE, alpha: 0.92 });
  g.circle(dir.x * 12 - side.x * 4, dir.y * 12 - side.y * 4 - 12, 2).fill({ color: OUTLINE, alpha: 0.92 });
  g.moveTo(dir.x * 7, dir.y * 7 - 4);
  g.lineTo(dir.x * 21, dir.y * 21 - 4);
  g.stroke({ color: 0xf4f6ff, width: 3, alpha: 0.88, cap: 'round' });
  g.circle(0, 0, 23).fill({ color: 0xffffff, alpha: flashAlpha });
  g.circle(-7, 9, 6).fill({ color: BODY_SHADOW, alpha: 0.26 });
  holder.addChild(g);

  if (options.label) drawName(holder, options.label);
}

export function handLoadout(hands: CombatHand[]): EquipmentLoadout {
  const loadout: EquipmentLoadout = {
    mainHand: hands.find((hand) => hand.side === 'main')?.weapon.id ?? 'iron-sword',
    offHand: hands.find((hand) => hand.side === 'off')?.weapon.id ?? null,
    head: null,
    body: null,
    legs: null,
    feet: null,
  };
  return normalizeLoadout(loadout);
}

export function handWeapon(hands: CombatHand[], side: CombatHandSide): WeaponDefinition | null {
  return hands.find((hand) => hand.side === side)?.weapon ?? null;
}
