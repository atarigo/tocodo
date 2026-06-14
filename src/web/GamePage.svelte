<script lang="ts">
  import CharacterPanel from './CharacterPanel.svelte';
  import BattleStage from './BattleStage.svelte';
  import LogPanel from './LogPanel.svelte';
  import { navigate } from './router.svelte.js';
  import { ui } from './store.svelte.js';
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">第 {ui.game.era} 紀元</span>
  <span class="records">最深紀錄 {ui.game.records.bestFloor} 層｜累計 {ui.game.records.lives} 段人生</span>
</header>

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
