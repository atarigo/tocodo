<script lang="ts">
  import { navigate } from '../web/router.svelte.js';
  import type { Attributes, CombatEvent } from './types.js';
  import AttributePanel from './AttributePanel.svelte';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';

  let events = $state<CombatEvent[]>([]);
  let playerAttrs = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  let enemyAttrs = $state<Attributes>({ str: 8, vit: 8, agi: 8, dex: 8, wil: 6, luk: 6 });
  let sessionId = $state(0);
  let started = $state(false);

  function addEvent(event: CombatEvent): void {
    events.unshift(event);
    if (events.length > 120) events.length = 120;
  }

  function startGame(): void {
    events = [];
    started = true;
    sessionId += 1;
  }

  function eventText(event: CombatEvent): string {
    switch (event.kind) {
      case 'damage':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 造成 ${event.target.name} ${event.amount} 點傷害`;
      case 'miss':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'}，${event.target.name} ${event.outcome}`;
      case 'status':
        return `${event.target.name} ${event.statusAction} ${event.statusName}`;
      case 'resource':
        return `${event.target.name} ${event.resource} ${event.amount}`;
      case 'death':
        return `${event.target.name} 倒下`;
      default:
        return '';
    }
  }
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">即時戰鬥</span>
</header>

<main class="realtime-layout">
  <aside class="realtime-left">
    <AttributePanel bind:playerAttrs bind:enemyAttrs />
  </aside>
  <section class="realtime-center">
    {#if started}
      {#key sessionId}
        <RealtimeCombatStage onEvent={addEvent} {playerAttrs} {enemyAttrs} {sessionId} />
      {/key}
    {:else}
      <div class="start-panel">
        <button class="primary" onclick={startGame}>開始遊戲</button>
      </div>
    {/if}
    {#if started}
      <div class="stage-actions">
        <button onclick={startGame}>重新開始</button>
      </div>
    {/if}
  </section>
  <aside class="realtime-log">
    <h2>戰鬥日誌</h2>
    <div class="log-list">
      {#each events as event (event.id)}
        <div class:player-line={event.source.side === 'player'} class:enemy-line={event.source.side === 'enemy'}>
          {eventText(event)}
        </div>
      {/each}
    </div>
  </aside>
</main>

<style>
  .realtime-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 320px minmax(420px, 1fr) 360px;
    gap: 10px;
    min-height: 0;
    padding: 10px;
  }

  .realtime-left,
  .realtime-center,
  .realtime-log {
    min-height: 0;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: var(--panel);
  }

  .realtime-left {
    overflow-y: auto;
    padding: 0;
  }

  .realtime-center {
    position: relative;
    overflow: hidden;
    padding: 12px;
  }

  .start-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 520px;
  }

  .stage-actions {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 2;
  }

  .stage-actions button {
    background: rgba(42, 45, 57, 0.88);
    backdrop-filter: blur(4px);
  }

  .realtime-log {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 12px;
  }

  .realtime-log h2 {
    flex: 0 0 auto;
    margin: 0 0 10px;
    color: var(--accent-2);
    font-size: 14px;
  }

  .log-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    line-height: 1.45;
  }

  .player-line {
    color: var(--good);
  }

  .enemy-line {
    color: var(--accent);
  }

  @media (max-width: 980px) {
    .realtime-layout {
      grid-template-columns: 1fr;
    }

    .realtime-left,
    .realtime-log {
      display: none;
    }
  }
</style>
