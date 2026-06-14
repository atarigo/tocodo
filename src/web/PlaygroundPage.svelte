<script lang="ts">
  import Playground from './Playground.svelte';
  import { navigate } from './router.svelte.js';
</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">實驗室</span>
</header>

<main class="layout-single">
  <section class="panel">
    <Playground />
  </section>
</main>
