<script lang="ts">
  import { navigate } from '../web/router.svelte.js';
  import type { CombatLogEntry } from './types.js';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';

  let logs = $state<CombatLogEntry[]>([]);

  function addLog(entry: CombatLogEntry): void {
    logs.unshift(entry);
    if (logs.length > 120) logs.length = 120;
  }
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">即時戰鬥</span>
</header>

<main class="realtime-layout">
  <aside class="side-slot"></aside>
  <section class="realtime-center">
    <RealtimeCombatStage onLog={addLog} />
  </section>
  <aside class="realtime-log">
    <h2>戰鬥日誌</h2>
    <div class="log-list">
      {#each logs as entry (entry.id)}
        <div class:player-line={entry.actorSide === 'player'} class:enemy-line={entry.actorSide === 'enemy'}>
          {entry.actorName} 使用 {entry.action} 造成 {entry.targetName} {entry.damage} 點傷害
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

  .side-slot,
  .realtime-center,
  .realtime-log {
    min-height: 0;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: var(--panel);
  }

  .side-slot {
    opacity: 0.35;
  }

  .realtime-center {
    overflow: hidden;
    padding: 12px;
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

    .side-slot,
    .realtime-log {
      display: none;
    }
  }
</style>
