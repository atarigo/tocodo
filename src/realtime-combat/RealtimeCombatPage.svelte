<script lang="ts">
  import { navigate } from '../web/router.svelte.js';
  import type { Attributes, BattleResult, CombatEvent, CombatHandSide, EquipmentLoadout } from './types.js';
  import AttributePanel from './AttributePanel.svelte';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';
  import { DEFAULT_LOADOUT } from './equipmentCatalog.js';

  let events = $state<CombatEvent[]>([]);
  let playerAttrs = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  let enemyAttrs = $state<Attributes>({ str: 8, vit: 8, agi: 8, dex: 8, wil: 6, luk: 6 });
  let playerLoadout = $state<EquipmentLoadout>({ ...DEFAULT_LOADOUT });
  let sessionId = $state(0);
  let started = $state(false);
  let battleResult = $state<BattleResult | null>(null);

  function addEvent(event: CombatEvent): void {
    events.unshift(event);
    if (events.length > 120) events.length = 120;
    if (event.kind === 'battleEnd') battleResult = event.result;
  }

  function startGame(): void {
    events = [];
    battleResult = null;
    started = true;
    sessionId += 1;
  }

  function outcomeNote(outcome: string): string {
    return outcome === '命中' ? '' : ` [${outcome}]`;
  }

  function attackHandNote(hand: CombatHandSide | undefined): string {
    if (hand === 'main') return ' [主手]';
    if (hand === 'off') return ' [副手]';
    return '';
  }

  function eventText(event: CombatEvent): string {
    switch (event.kind) {
      case 'damage':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 造成 ${event.target.name} ${event.amount} 點傷害${attackHandNote(event.hand)}${outcomeNote(event.outcome)}`;
      case 'miss':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'}，${event.target.name} ${event.outcome}${attackHandNote(event.hand)}`;
      case 'status':
        return `${event.target.name} ${event.statusAction} ${event.statusName}`;
      case 'resource':
        return `${event.target.name} ${event.resource} ${event.amount}`;
      case 'death':
        return `${event.target.name} 倒下`;
      case 'battleEnd':
        return event.result === 'playerWon' ? '戰鬥結束：玩家勝利' : '戰鬥結束：玩家失敗';
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
    <AttributePanel bind:playerAttrs bind:enemyAttrs bind:playerLoadout />
  </aside>
  <section class="realtime-center">
    {#if started}
      {#key sessionId}
        <RealtimeCombatStage onEvent={addEvent} {playerAttrs} {enemyAttrs} {playerLoadout} {sessionId} />
      {/key}
      {#if battleResult}
        <div class="result-panel">
          <div class="result-title">{battleResult === 'playerWon' ? '勝利' : '失敗'}</div>
          <button class="primary" onclick={startGame}>重新開始</button>
        </div>
      {/if}
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

  .result-panel {
    position: absolute;
    inset: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(17, 19, 26, 0.72);
    backdrop-filter: blur(3px);
    border-radius: 6px;
  }

  .result-title {
    color: var(--text);
    font-size: 32px;
    font-weight: 700;
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
