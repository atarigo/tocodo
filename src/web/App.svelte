<script lang="ts">
  import CharacterPanel from './CharacterPanel.svelte';
  import BattleStage from './BattleStage.svelte';
  import LogPanel from './LogPanel.svelte';
  import Playground from './Playground.svelte';
  import { ui } from './store.svelte.js';

  let view = $state<'game' | 'playground'>('game');
</script>

<header class="topbar">
  <h1>血腥都市</h1>
  <span class="era">第 {ui.game.era} 紀元</span>
  <nav class="view-switch">
    <button class:active={view === 'game'} onclick={() => (view = 'game')}>遊戲</button>
    <button class:active={view === 'playground'} onclick={() => (view = 'playground')}>實驗室</button>
  </nav>
  <span class="records">最深紀錄 {ui.game.records.bestFloor} 層｜累計 {ui.game.records.lives} 段人生</span>
</header>

{#if view === 'game'}
  <main class="layout">
    <aside class="panel left">
      <CharacterPanel />
    </aside>
    <section class="panel center">
      <BattleStage />
    </section>
    <aside class="panel right">
      <LogPanel />
    </aside>
  </main>
{:else}
  <main class="layout-single">
    <section class="panel">
      <Playground />
    </section>
  </main>
{/if}
