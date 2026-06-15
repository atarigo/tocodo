<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { RealtimeCombatEngine } from '../core/engine.js';
  import { drawPlayerSprite, handLoadout, loadPlayerSpritesheet } from './playerSprite.js';
  import type { ActionBarState, BattleSetup, CombatEvent, Combatant, CombatStageSnapshot, InputState, StatusEffect, Strike, Vec2 } from '../core/types.js';
  import { ARENA_HEIGHT, ARENA_WIDTH } from '../core/types.js';

  let {
    onEvent,
    onPlayerActionState,
    onPlayerStatuses,
    onSnapshot,
    setup,
    sessionId,
  }: {
    onEvent?: (event: CombatEvent) => void;
    onPlayerActionState?: (state: ActionBarState) => void;
    onPlayerStatuses?: (statuses: StatusEffect[]) => void;
    onSnapshot?: (snapshot: CombatStageSnapshot) => void;
    setup: BattleSetup;
    sessionId: number;
  } = $props();

  let host: HTMLDivElement;

  const keys = new Set<string>();
  const pointer: Vec2 = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
  const input: InputState = {
    move: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    attacking: false,
  };

  let app: Application | undefined;
  let engine: RealtimeCombatEngine | undefined;
  let world: Container | undefined;
  let entitiesLayer: Container | undefined;
  let effectsLayer: Container | undefined;
  let projectilesLayer: Container | undefined;
  let rafCleanup: (() => void) | undefined;
  let elapsed = 0;

  function syncMovement(): void {
    input.move.x = 0;
    input.move.y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) input.move.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) input.move.x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) input.move.y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) input.move.y += 1;
    input.attacking = keys.has('Space') || input.attacking;
  }

  function syncAimFromPointer(): void {
    if (!engine) return;
    input.aim.x = pointer.x - engine.player.position.x;
    input.aim.y = pointer.y - engine.player.position.y;
  }

  function aiStateText(combatant: Combatant): string {
    if (combatant.faction === 'player') return '';
    if (combatant.aiState === 'guard') return '守衛';
    if (combatant.aiState === 'patrol') return '巡邏';
    if (combatant.aiState === 'combat') return '戰鬥';
    return '返回';
  }

  function drawCombatant(layer: Container, combatant: Combatant): void {
    if (combatant.faction === 'player') {
      drawPlayerSprite(layer, {
        elapsed,
        facing: combatant.facing,
        flash: combatant.flash,
        hpRatio: combatant.maxHp > 0 ? combatant.hp / combatant.maxHp : 0,
        label: combatant.name,
        loadout: handLoadout(combatant.hands),
        moving: Math.hypot(input.move.x, input.move.y) > 0,
        mpRatio: combatant.maxMp > 0 ? combatant.mp / combatant.maxMp : 0,
        position: combatant.position,
      });
      return;
    }

    const g = new Graphics();
    const flashAlpha = combatant.flash > 0 ? 0.35 + Math.sin(combatant.flash * 80) * 0.25 : 0;
    const hpRatio = combatant.maxHp > 0 ? combatant.hp / combatant.maxHp : 0;
    const mpRatio = combatant.maxMp > 0 ? combatant.mp / combatant.maxMp : 0;

    g.roundRect(-34, -50, 68, 5, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
    g.roundRect(-34, -50, 68 * hpRatio, 5, 2).fill({ color: 0xe0564b });
    g.roundRect(-34, -42, 68, 4, 2).fill({ color: 0x0d0f14, alpha: 0.9 });
    g.roundRect(-34, -42, 68 * mpRatio, 4, 2).fill({ color: 0x5b8def });
    g.circle(0, 0, combatant.radius + 4).fill({ color: 0xffffff, alpha: flashAlpha });
    g.circle(0, 0, combatant.radius).fill({ color: combatant.flash > 0 ? 0xffffff : combatant.color });
    g.circle(0, 0, combatant.radius).stroke({ color: 0x11131a, width: 3, alpha: 0.8 });
    g.moveTo(Math.cos(combatant.facing) * 4, Math.sin(combatant.facing) * 4);
    g.lineTo(Math.cos(combatant.facing) * (combatant.radius + 11), Math.sin(combatant.facing) * (combatant.radius + 11));
    g.stroke({ color: 0xf4f6ff, width: 3, alpha: 0.9 });
    g.position.set(combatant.position.x, combatant.position.y);
    layer.addChild(g);

    const label = new Text({
      text: combatant.name,
      style: {
        fill: 0xd8dae3,
        fontFamily: 'Helvetica Neue, PingFang TC, Microsoft JhengHei, sans-serif',
        fontSize: 11,
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(combatant.position.x, combatant.position.y - 54);
    layer.addChild(label);

    const state = aiStateText(combatant);
    if (state) {
      const stateLabel = new Text({
        text: state,
        style: {
          fill: combatant.aiState === 'combat' ? 0xff6b5f : combatant.aiState === 'returning' ? 0xc7b98b : 0x9aa0af,
          fontFamily: 'Helvetica Neue, PingFang TC, Microsoft JhengHei, sans-serif',
          fontSize: 10,
        },
      });
      stateLabel.anchor.set(0.5, 0);
      stateLabel.position.set(combatant.position.x, combatant.position.y - 38);
      layer.addChild(stateLabel);
    }
  }

  function drawStrike(layer: Container, strike: Strike): void {
    const g = new Graphics();
    const alpha = Math.max(0, Math.min(1, strike.ttl / 0.2));
    const start = strike.angle - strike.arc / 2;
    const end = strike.angle + strike.arc / 2;

    if (strike.style === 'arc') {
      g.arc(0, 0, strike.range, start, end);
      g.stroke({ color: strike.color, width: 10, alpha: 0.32 * alpha });
      g.arc(0, 0, strike.range * 0.72, start, end);
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.7 * alpha });
    } else {
      const ax = Math.cos(start) * strike.range;
      const ay = Math.sin(start) * strike.range;
      const bx = Math.cos(end) * strike.range;
      const by = Math.sin(end) * strike.range;
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke({ color: strike.color, width: 12, alpha: 0.35 * alpha });
      g.moveTo(ax * 0.72, ay * 0.72);
      g.lineTo(bx * 0.72, by * 0.72);
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.8 * alpha });
    }

    g.position.set(strike.position.x, strike.position.y);
    layer.addChild(g);
  }

  function render(): void {
    if (!engine || !entitiesLayer || !effectsLayer || !projectilesLayer) return;

    entitiesLayer.removeChildren().forEach((child) => child.destroy());
    effectsLayer.removeChildren().forEach((child) => child.destroy());
    projectilesLayer.removeChildren().forEach((child) => child.destroy());

    for (const obstacle of engine.obstacles) {
      const g = new Graphics();
      g.roundRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 4).fill({ color: 0x2b2f3a });
      g.roundRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 4).stroke({ color: 0x4a5060, width: 2 });
      g.position.set(obstacle.position.x, obstacle.position.y);
      entitiesLayer.addChild(g);
    }

    for (const strike of engine.strikes) drawStrike(effectsLayer, strike);
    for (const impact of engine.impacts) {
      const g = new Graphics();
      const progress = 1 - impact.ttl / 0.18;
      g.circle(0, 0, 8 + progress * 18).stroke({ color: 0xffffff, width: 2, alpha: (1 - progress) * 0.7 });
      g.position.set(impact.position.x, impact.position.y);
      effectsLayer.addChild(g);
    }
    for (const projectile of engine.projectiles) {
      const g = new Graphics();
      g.circle(0, 0, projectile.radius + 3).fill({ color: 0xb04bd9, alpha: 0.25 });
      g.circle(0, 0, projectile.radius).fill({ color: 0xf1d4ff });
      g.position.set(projectile.position.x, projectile.position.y);
      projectilesLayer.addChild(g);
    }
    for (const damageText of engine.damageTexts) {
      const label = new Text({
        text: damageText.text,
        style: {
          fill: 0xff4d42,
          fontFamily: 'Helvetica Neue, PingFang TC, Microsoft JhengHei, sans-serif',
          fontSize: 20,
          fontWeight: '700',
          stroke: { color: 0x16171d, width: 4 },
        },
      });
      label.anchor.set(0.5, 0.5);
      label.alpha = Math.max(0, Math.min(1, damageText.ttl / 0.35));
      label.position.set(damageText.position.x, damageText.position.y);
      label.style.fill = damageText.color ?? 0xff4d42;
      effectsLayer.addChild(label);
    }
    drawCombatant(entitiesLayer, engine.player);
    for (const enemy of engine.enemies) drawCombatant(entitiesLayer, enemy);
    for (const ally of engine.allies) drawCombatant(entitiesLayer, ally);
    for (const neutral of engine.neutrals) drawCombatant(entitiesLayer, neutral);
  }

  function resize(): void {
    if (!app || !world) return;
    const bounds = host.getBoundingClientRect();
    app.renderer.resize(Math.max(320, bounds.width), Math.max(240, bounds.height));
    const scale = Math.min(bounds.width / ARENA_WIDTH, bounds.height / ARENA_HEIGHT);
    world.scale.set(scale);
    world.position.set((bounds.width - ARENA_WIDTH * scale) / 2, (bounds.height - ARENA_HEIGHT * scale) / 2);
  }

  onMount(() => {
    let destroyed = false;
    const localEngine = new RealtimeCombatEngine({
      seed: sessionId,
      onEvent,
      setup,
    });
    engine = localEngine;

    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code.startsWith('Digit')) {
        const slot = Number(event.code.replace('Digit', '')) - 1;
        if (slot >= 0 && slot < 5) localEngine.usePlayerSkillSlot(slot);
      }
      if (event.code === 'KeyQ') localEngine.usePlayerItemSlot(0);
      if (event.code === 'KeyE') localEngine.usePlayerItemSlot(1);
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.code);
      if (event.code === 'Space') input.attacking = false;
    };
    const onBlur = () => keys.clear();
    const onPointerMove = (event: PointerEvent) => {
      if (!world) return;
      const rect = host.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left - world.position.x) / world.scale.x;
      pointer.y = (event.clientY - rect.top - world.position.y) / world.scale.y;
      syncAimFromPointer();
    };
    const onPointerDown = () => {
      input.attacking = true;
    };
    const onPointerUp = () => {
      input.attacking = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', resize);

    void (async () => {
      const localApp = new Application();
      await localApp.init({ antialias: true, background: '#11131a', width: host.clientWidth, height: host.clientHeight });
      if (destroyed) {
        localApp.destroy(true);
        return;
      }

      app = localApp;
      await loadPlayerSpritesheet();
      host.appendChild(localApp.canvas);
      world = new Container();
      effectsLayer = new Container();
      projectilesLayer = new Container();
      entitiesLayer = new Container();

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

      world.addChild(floor, effectsLayer, projectilesLayer, entitiesLayer);
      localApp.stage.addChild(world);
      resize();

      localApp.ticker.add((ticker) => {
        syncMovement();
        syncAimFromPointer();
        const dt = ticker.deltaMS / 1000;
        elapsed += dt;
        localEngine.step(input, dt);
        onPlayerStatuses?.(localEngine.statusEffects.filter((effect) => effect.targetId === localEngine.player.id));
        onPlayerActionState?.({
          skillCooldowns: localEngine.player.skillSlots.map((skillId) => (skillId ? (localEngine.player.skillCooldowns[skillId] ?? 0) : 0)),
          skillFailureReasons: localEngine.player.skillSlots.map((_, index) => localEngine.playerSkillFailureReason(index)),
          itemUsed: [...localEngine.player.itemUsed],
        });
        onSnapshot?.({
          elapsed,
          enemyAliveCount: localEngine.enemies.filter((enemy) => enemy.hp > 0).length,
        });
        render();
      });
    })();

    rafCleanup = () => {
      destroyed = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', resize);
      localEngine.destroy();
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
    cursor: crosshair;
  }

  .stage-shell :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
