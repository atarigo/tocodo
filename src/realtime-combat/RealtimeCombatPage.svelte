<script lang="ts">
  import { navigate } from '../web/router.svelte.js';
  import type {
    ActionBarState,
    ActionLoadout,
    Attributes,
    BattleResult,
    BattleSetup,
    CombatEvent,
    CombatHandSide,
    DifficultyRank,
    EquipmentLoadout,
    StatusEffect,
  } from './types.js';
  import AttributePanel from './AttributePanel.svelte';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';
  import { createRandomBattleSetup, DEFAULT_ACTION_LOADOUT } from './battleSetup.js';
  import { DEFAULT_LOADOUT } from './equipmentCatalog.js';
  import { itemById } from './itemCatalog.js';
  import { skillById } from './skillCatalog.js';

  let events = $state<CombatEvent[]>([]);
  let playerAttrs = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  let enemyDifficulty = $state<DifficultyRank>('D');
  let playerLoadout = $state<EquipmentLoadout>({ ...DEFAULT_LOADOUT });
  let actionLoadout = $state<ActionLoadout>({
    skillSlots: [...DEFAULT_ACTION_LOADOUT.skillSlots],
    itemSlots: [...DEFAULT_ACTION_LOADOUT.itemSlots],
  });
  let battleSetup = $state<BattleSetup | null>(null);
  let playerStatuses = $state<StatusEffect[]>([]);
  let playerActionState = $state<ActionBarState>({ skillCooldowns: [0, 0, 0, 0, 0], itemUsed: [false, false] });
  let sessionId = $state(0);
  let started = $state(false);
  let battleResult = $state<BattleResult | null>(null);

  function addEvent(event: CombatEvent): void {
    events.unshift(event);
    if (events.length > 120) events.length = 120;
    if (event.kind === 'battleEnd') battleResult = event.result;
  }

  function startGame(): void {
    const nextSessionId = sessionId + 1;
    events = [];
    playerStatuses = [];
    playerActionState = { skillCooldowns: [0, 0, 0, 0, 0], itemUsed: [false, false] };
    battleResult = null;
    battleSetup = createRandomBattleSetup({
      playerAttrs,
      loadout: playerLoadout,
      actionLoadout,
      difficulty: enemyDifficulty,
      seed: nextSessionId,
    });
    started = true;
    sessionId = nextSessionId;
  }

  function outcomeNote(outcome: string): string {
    return outcome === '命中' ? '' : ` [${outcome}]`;
  }

  function attackHandNote(hand: CombatHandSide | undefined): string {
    if (hand === 'main') return ' [主手]';
    if (hand === 'off') return ' [副手]';
    return '';
  }

  function statusActionText(action: 'apply' | 'expire' | 'resist'): string {
    if (action === 'apply') return '受到';
    if (action === 'expire') return '結束';
    return '抵抗';
  }

  function eventText(event: CombatEvent): string {
    switch (event.kind) {
      case 'damage':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 造成 ${event.target.name} ${event.amount} 點傷害${attackHandNote(event.hand)}${outcomeNote(event.outcome)}`;
      case 'miss':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'}，${event.target.name} ${event.outcome}${attackHandNote(event.hand)}`;
      case 'status':
        return `${event.target.name} ${statusActionText(event.statusAction)} ${event.statusName}`;
      case 'resource':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 恢復 ${event.target.name} ${event.amount} 點 ${event.resource.toUpperCase()}`;
      case 'death':
        return `${event.target.name} 倒下`;
      case 'battleEnd':
        return event.result === 'playerWon' ? '戰鬥結束：玩家勝利' : '戰鬥結束：玩家失敗';
      default:
        return '';
    }
  }

  function skillCooldown(slotIndex: number): number {
    return playerActionState.skillCooldowns[slotIndex] ?? 0;
  }

  function itemWasUsed(slotIndex: number): boolean {
    return playerActionState.itemUsed[slotIndex] ?? false;
  }
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">即時戰鬥</span>
</header>

<main class="realtime-layout">
  <aside class="realtime-left">
    <AttributePanel bind:playerAttrs bind:enemyDifficulty bind:playerLoadout bind:actionLoadout {battleSetup} />
  </aside>
  <section class="realtime-center">
    {#if started && battleSetup}
      {#key sessionId}
        <RealtimeCombatStage
          onEvent={addEvent}
          onPlayerActionState={(state) => (playerActionState = state)}
          onPlayerStatuses={(statuses) => (playerStatuses = statuses)}
          setup={battleSetup}
          {sessionId}
        />
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
        <div class="status-badges">
          {#each playerStatuses as status (status.id)}
            <div class="status-badge" class:buff-badge={status.kind === 'buff'}>
              <span>{status.name}</span>
              <strong>{Math.max(0, status.remaining).toFixed(1)}s</strong>
            </div>
          {/each}
        </div>
        <button onclick={startGame}>重新開始</button>
      </div>
      <div class="quickbar">
        <div class="quickbar-row skills">
          {#each Array(5) as _, index}
            <div class="quick-slot" class:cooling={skillCooldown(index) > 0}>
              {#if actionLoadout.skillSlots[index]}
                <strong>{skillById(actionLoadout.skillSlots[index]).name}</strong>
                {#if skillCooldown(index) > 0}
                  <em>{skillCooldown(index).toFixed(1)}</em>
                {/if}
              {/if}
              <span>{index + 1}</span>
            </div>
          {/each}
        </div>
        <div class="quickbar-row items">
          {#each Array(2) as _, index}
            <div class="quick-slot item-slot" class:used={itemWasUsed(index)}>
              {#if actionLoadout.itemSlots[index] && !itemWasUsed(index)}
                <strong>{itemById(actionLoadout.itemSlots[index]).name}</strong>
              {/if}
              <span>{index === 0 ? 'Q' : 'E'}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
  <aside class="realtime-log">
    <h2>戰鬥日誌</h2>
    <div class="log-list">
      {#each events as event (event.id)}
        <div
          class:player-line={event.source.side === 'player'}
          class:enemy-line={event.source.side === 'enemy'}
          class:ally-line={event.source.side === 'ally'}
          class:neutral-line={event.source.side === 'neutral'}
        >
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
    left: 20px;
    right: 20px;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    pointer-events: none;
  }

  .stage-actions button {
    background: rgba(42, 45, 57, 0.88);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .status-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
    pointer-events: none;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 76px;
    height: 28px;
    padding: 0 9px;
    border: 1px solid rgba(255, 95, 90, 0.85);
    border-radius: 4px;
    background: rgba(37, 19, 22, 0.9);
    color: #ffd6d3;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    backdrop-filter: blur(4px);
  }

  .status-badge.buff-badge {
    border-color: rgba(94, 211, 132, 0.82);
    background: rgba(20, 58, 35, 0.9);
    color: #d7ffe0;
  }

  .status-badge strong {
    margin-left: auto;
    font-weight: 600;
  }

  .quickbar {
    position: absolute;
    left: 50%;
    bottom: 22px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .quickbar-row {
    display: flex;
    gap: 6px;
  }

  .quick-slot {
    position: relative;
    width: 42px;
    height: 42px;
    border: 1px solid rgba(216, 218, 227, 0.28);
    border-radius: 4px;
    background: rgba(20, 22, 29, 0.82);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(4px);
  }

  .quick-slot.cooling {
    border-color: rgba(142, 147, 160, 0.42);
    background: rgba(48, 51, 59, 0.86);
    filter: grayscale(0.9);
  }

  .quick-slot.used {
    border-color: rgba(216, 218, 227, 0.16);
    background: rgba(13, 15, 20, 0.7);
  }

  .quick-slot span {
    position: absolute;
    right: 5px;
    bottom: 3px;
    color: var(--muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .quick-slot strong {
    position: absolute;
    inset: 6px 5px 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--text);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
  }

  .quick-slot em {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f0f1f4;
    font-size: 13px;
    font-style: normal;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    background: rgba(24, 25, 30, 0.48);
  }

  .item-slot {
    width: 40px;
    height: 40px;
    border-color: rgba(199, 185, 139, 0.38);
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

  .ally-line {
    color: var(--good);
  }

  .neutral-line {
    color: #c7b98b;
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
