import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { getEquipment, getOffhandWeapon, getWeapon, normalizeLoadout } from '../data/equipmentCatalog.js';
import type { CombatHand, EquipmentLoadout, Vec2, WeaponDefinition } from '../core/types.js';
import playerSpritesheetUrl from './assets/player-spritesheet.png';

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

const SHEET_COLUMNS = 10;
const SHEET_ROWS = 4;
const SHEET_WIDTH = 1536;
const SHEET_HEIGHT = 1024;
const CELL_WIDTH = SHEET_WIDTH / SHEET_COLUMNS;
const CELL_HEIGHT = SHEET_HEIGHT / SHEET_ROWS;
const FRAME_CROP = 4;
const SPRITE_SCALE = 0.36;

let frameTextures: Texture[] | null = null;

export async function loadPlayerSpritesheet(): Promise<void> {
  if (frameTextures) return;
  const sheet = await Assets.load<Texture>(playerSpritesheetUrl);
  frameTextures = [];
  for (let row = 0; row < SHEET_ROWS; row += 1) {
    for (let col = 0; col < SHEET_COLUMNS; col += 1) {
      frameTextures.push(new Texture({
        source: sheet.source,
        frame: new Rectangle(
          col * CELL_WIDTH + FRAME_CROP,
          row * CELL_HEIGHT + FRAME_CROP,
          CELL_WIDTH - FRAME_CROP * 2,
          CELL_HEIGHT - FRAME_CROP * 2,
        ),
      }));
    }
  }
}

function directionRow(angle: number): number {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (normalized >= Math.PI / 4 && normalized < (Math.PI * 3) / 4) return 0;
  if (normalized >= (Math.PI * 3) / 4 && normalized < (Math.PI * 5) / 4) return 1;
  if (normalized >= (Math.PI * 5) / 4 && normalized < (Math.PI * 7) / 4) return 3;
  return 2;
}

function weaponColumn(weapon: WeaponDefinition): number {
  if (weapon.id === 'dagger' || weapon.id === 'offhand-dagger') return 4;
  if (weapon.id === 'greatsword') return 5;
  if (weapon.id === 'spear') return 6;
  if (weapon.id === 'hunting-bow') return 7;
  if (weapon.id === 'pistol' || weapon.id === 'revolver') return 8;
  if (weapon.id === 'rifle') return 9;
  return 3;
}

function frameColumn(options: PlayerSpriteOptions): number {
  const normalized = normalizeLoadout(options.loadout);
  const mainWeapon = getWeapon(normalized);
  if (options.moving) return Math.floor(options.elapsed * 8) % 2 === 0 ? 1 : 2;
  return weaponColumn(mainWeapon);
}

function drawBars(layer: Container, hpRatio: number, mpRatio: number): void {
  const g = new Graphics();
  g.roundRect(-34, -58, 68, 5, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
  g.roundRect(-34, -58, 68 * hpRatio, 5, 2).fill({ color: 0xe0564b });
  g.roundRect(-34, -50, 68, 4, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
  g.roundRect(-34, -50, 68 * mpRatio, 4, 2).fill({ color: 0x5b8def });
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
  name.position.set(0, -62);
  layer.addChild(name);
}

function drawFallback(layer: Container, options: PlayerSpriteOptions): void {
  const g = new Graphics();
  const flashAlpha = options.flash && options.flash > 0 ? 0.35 + Math.sin(options.flash * 80) * 0.25 : 0;
  g.circle(0, 0, 21).fill({ color: 0xffffff, alpha: flashAlpha });
  g.circle(0, 0, 17).fill({ color: options.flash && options.flash > 0 ? 0xffffff : 0x69c981 });
  g.circle(0, 0, 17).stroke({ color: 0x11131a, width: 3, alpha: 0.8 });
  g.moveTo(Math.cos(options.facing) * 4, Math.sin(options.facing) * 4);
  g.lineTo(Math.cos(options.facing) * 28, Math.sin(options.facing) * 28);
  g.stroke({ color: 0xf4f6ff, width: 3, alpha: 0.9 });
  layer.addChild(g);
}

export function drawPlayerSprite(layer: Container, options: PlayerSpriteOptions): void {
  const holder = new Container();
  holder.position.set(options.position.x, options.position.y);
  holder.alpha = options.alpha ?? 1;
  layer.addChild(holder);

  if (options.hpRatio !== undefined || options.mpRatio !== undefined) drawBars(holder, options.hpRatio ?? 1, options.mpRatio ?? 1);

  const row = directionRow(options.facing);
  const col = frameColumn(options);
  const texture = frameTextures?.[row * SHEET_COLUMNS + col];

  if (texture) {
    const sprite = new Sprite({ texture, anchor: 0.5 });
    sprite.scale.set(SPRITE_SCALE);
    sprite.position.set(0, 4);
    if (options.flash && options.flash > 0) sprite.tint = 0xffffff;
    holder.addChild(sprite);
  } else {
    drawFallback(holder, options);
  }

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

export function hasVisibleOffhand(loadout: EquipmentLoadout): boolean {
  const normalized = normalizeLoadout(loadout);
  const offhandWeapon = getOffhandWeapon(normalized);
  const offhandItem = normalized.offHand ? getEquipment(normalized.offHand) : null;
  return !!offhandWeapon || offhandItem?.id === 'wooden-shield';
}
