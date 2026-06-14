<script lang="ts">
  import { navigate } from '../web/router.svelte.js';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">即時戰鬥</span>
</header>

<main class="realtime-layout">
  <aside class="side-slot"></aside>
  <section class="realtime-center">
    <RealtimeCombatStage />
  </section>
  <aside class="side-slot"></aside>
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
  .realtime-center {
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

  @media (max-width: 980px) {
    .realtime-layout {
      grid-template-columns: 1fr;
    }

    .side-slot {
      display: none;
    }
  }
</style>
