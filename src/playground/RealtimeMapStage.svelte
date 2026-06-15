<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { DEFAULT_LOADOUT } from '../data/equipmentCatalog.js';
  import type { GameScene } from './gameFlow.js';
  import { drawPlayerSprite, loadPlayerSpritesheet } from './playerSprite.js';
  import type { EquipmentLoadout } from '../core/types.js';
  import { ARENA_HEIGHT, ARENA_WIDTH } from '../core/types.js';

  export interface MapNearbyState {
    novicePortal: boolean;
    noviceNpc: boolean;
    rewardAltar: boolean;
    rewardPlatform: boolean;
    cityShop: boolean;
    cityPortal: boolean;
  }

  let {
    scene,
    playerLoadout = DEFAULT_LOADOUT,
    onNearbyChange,
  }: {
    scene: GameScene;
    playerLoadout?: EquipmentLoadout;
    onNearbyChange?: (state: MapNearbyState) => void;
  } = $props();

  let host: HTMLDivElement;
  let app: Application | undefined;
  let world: Container | undefined;
  let rafCleanup: (() => void) | undefined;

  const keys = new Set<string>();
  const player = { x: 240, y: 410 };
  let elapsed = 0;
  let facing = -Math.PI / 2;
  let moving = false;
  let lastScene = $state<GameScene | null>(null);

  const starts: Partial<Record<GameScene, { x: number; y: number }>> = {
    novicePlaza: { x: 240, y: 410 },
    noviceReward: { x: 400, y: 456 },
    rewardPlatform: { x: 400, y: 456 },
    city: { x: 400, y: 432 },
  };

  function resetPlayer(): void {
    const start = starts[scene] ?? starts.novicePlaza;
    if (!start) return;
    player.x = start.x;
    player.y = start.y;
  }

  function mapObjectPosition(id: keyof MapNearbyState): { x: number; y: number } {
    if (id === 'novicePortal') return { x: 512, y: 246 };
    if (id === 'noviceNpc') return { x: 376, y: 204 };
    if (id === 'rewardAltar') return { x: 400, y: 252 };
    if (id === 'rewardPlatform') return { x: 400, y: 252 };
    if (id === 'cityShop') return { x: 256, y: 270 };
    if (id === 'cityPortal') return { x: 560, y: 264 };
    return { x: 400, y: 300 };
  }

  function nearby(id: keyof MapNearbyState, radius = 92): boolean {
    const target = mapObjectPosition(id);
    return Math.hypot(player.x - target.x, player.y - target.y) <= radius;
  }

  function emitNearby(): void {
    onNearbyChange?.({
      novicePortal: scene === 'novicePlaza' && nearby('novicePortal'),
      noviceNpc: scene === 'novicePlaza' && nearby('noviceNpc'),
      rewardAltar: scene === 'noviceReward' && nearby('rewardAltar'),
      rewardPlatform: scene === 'rewardPlatform' && nearby('rewardPlatform'),
      cityShop: scene === 'city' && nearby('cityShop'),
      cityPortal: scene === 'city' && nearby('cityPortal'),
    });
  }

  function move(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    moving = dx !== 0 || dy !== 0;
    if (!moving) return;
    const length = Math.hypot(dx, dy) || 1;
    const speed = 170;
    facing = Math.atan2(dy, dx);
    player.x = clamp(player.x + (dx / length) * speed * dt, 34, ARENA_WIDTH - 34);
    player.y = clamp(player.y + (dy / length) * speed * dt, 42, ARENA_HEIGHT - 42);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function drawLabel(layer: Container, text: string, x: number, y: number, color = 0xd8dae3): void {
    const label = new Text({
      text,
      style: {
        fill: color,
        fontFamily: 'Helvetica Neue, PingFang TC, Microsoft JhengHei, sans-serif',
        fontSize: 13,
        fontWeight: '700',
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(x, y);
    layer.addChild(label);
  }

  function drawFloor(layer: Container): void {
    const floor = new Graphics();
    floor.roundRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT, 4).fill({ color: 0x171a21 });
    floor.roundRect(18, 18, ARENA_WIDTH - 36, ARENA_HEIGHT - 36, 4).stroke({ color: 0x2c2f3a, width: 2, alpha: 0.85 });
    for (let x = 80; x < ARENA_WIDTH; x += 80) {
      floor.moveTo(x, 18);
      floor.lineTo(x, ARENA_HEIGHT - 18);
    }
    for (let y = 80; y < ARENA_HEIGHT; y += 80) {
      floor.moveTo(18, y);
      floor.lineTo(ARENA_WIDTH - 18, y);
    }
    floor.stroke({ color: 0x242834, width: 1, alpha: 0.55 });
    layer.addChild(floor);
  }

  function drawCircle(layer: Container, x: number, y: number, radius: number, color: number, label?: string, labelColor = 0xd8dae3): void {
    const g = new Graphics();
    g.circle(0, 0, radius).fill({ color });
    g.circle(0, 0, radius).stroke({ color: 0xd8dae3, width: 3, alpha: 0.68 });
    g.position.set(x, y);
    layer.addChild(g);
    if (label) drawLabel(layer, label, x, y + radius + 7, labelColor);
  }

  function drawPortal(layer: Container, x: number, y: number): void {
    const g = new Graphics();
    g.ellipse(0, 0, 38, 54).fill({ color: 0x31406d, alpha: 0.88 });
    g.ellipse(0, 0, 38, 54).stroke({ color: 0x7893ef, width: 5, alpha: 0.92 });
    g.circle(0, 0, 28).fill({ color: 0xcfd9ff, alpha: 0.16 });
    g.position.set(x, y);
    layer.addChild(g);
    drawLabel(layer, '傳送門', x, y + 62);
  }

  function drawPlaza(layer: Container): void {
    const ring = new Graphics();
    ring.ellipse(400, 300, 150, 92).stroke({ color: 0x8d8776, width: 17, alpha: 0.46 });
    layer.addChild(ring);
    drawPortal(layer, 512, 246);
    drawCircle(layer, 376, 204, 15, 0xcaa955, '說明 NPC', 0xffe6a4);
    const crowd = [
      [160, 180], [212, 252], [202, 430], [310, 160], [342, 438], [440, 410],
      [580, 172], [620, 298], [650, 438], [250, 492], [486, 140], [540, 428], [404, 494],
    ];
    for (const [x, y] of crowd) drawCircle(layer, x, y, 13, 0x8b929f);
  }

  function drawReward(layer: Container, label: string): void {
    const g = new Graphics();
    g.roundRect(-48, -25, 96, 50, 6).fill({ color: 0x504026 });
    g.roundRect(-48, -25, 96, 50, 6).stroke({ color: 0xdcc684, width: 2, alpha: 0.75 });
    g.position.set(400, 252);
    layer.addChild(g);
    drawLabel(layer, label, 400, 286, 0xf0e4b8);
  }

  function drawCity(layer: Container): void {
    const shop = new Graphics();
    shop.roundRect(-48, -32, 96, 64, 6).fill({ color: 0x314031 });
    shop.roundRect(-48, -32, 96, 64, 6).stroke({ color: 0x70ca8b, width: 2, alpha: 0.72 });
    shop.position.set(256, 270);
    layer.addChild(shop);
    drawLabel(layer, '商店', 256, 310, 0xd8ffe3);
    drawPortal(layer, 560, 264);
  }

  function drawScene(): void {
    if (!world) return;
    world.removeChildren().forEach((child) => child.destroy());
    drawFloor(world);
    if (scene === 'novicePlaza') drawPlaza(world);
    if (scene === 'noviceReward') drawReward(world, '新手獎勵');
    if (scene === 'rewardPlatform') drawReward(world, '結算核心');
    if (scene === 'city') drawCity(world);
    drawPlayerSprite(world, {
      elapsed,
      facing,
      label: '玩家',
      loadout: playerLoadout,
      moving,
      position: player,
    });
  }

  function resize(): void {
    if (!app || !world) return;
    const bounds = host.getBoundingClientRect();
    app.renderer.resize(Math.max(320, bounds.width), Math.max(240, bounds.height));
    const scale = Math.min(bounds.width / ARENA_WIDTH, bounds.height / ARENA_HEIGHT);
    world.scale.set(scale);
    world.position.set((bounds.width - ARENA_WIDTH * scale) / 2, (bounds.height - ARENA_HEIGHT * scale) / 2);
  }

  $effect(() => {
    if (scene !== lastScene) {
      lastScene = scene;
      resetPlayer();
      emitNearby();
    }
  });

  onMount(() => {
    let destroyed = false;
    let last = performance.now();

    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onBlur = () => keys.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);

    void (async () => {
      const localApp = new Application();
      await localApp.init({
        antialias: true,
        autoDensity: true,
        background: '#11131a',
        resolution: window.devicePixelRatio || 1,
        width: host.clientWidth,
        height: host.clientHeight,
      });
      if (destroyed) {
        localApp.destroy(true);
        return;
      }
      app = localApp;
      await loadPlayerSpritesheet();
      host.appendChild(localApp.canvas);
      world = new Container();
      localApp.stage.addChild(world);
      resetPlayer();
      resize();
      localApp.ticker.add(() => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        elapsed += dt;
        move(dt);
        emitNearby();
        drawScene();
      });
    })();

    rafCleanup = () => {
      destroyed = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      app?.destroy(true);
    };
  });

  onDestroy(() => {
    rafCleanup?.();
  });
</script>

<div class="stage-shell" bind:this={host}></div>

<style>
  .stage-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 520px;
    overflow: hidden;
    border-radius: 6px;
    background: #11131a;
    touch-action: none;
    cursor: default;
  }

  .stage-shell :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
