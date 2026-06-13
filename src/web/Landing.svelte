<script lang="ts">
  import { navigate } from './router.svelte.js';
</script>

<main class="landing">
  <h1>血腥都市</h1>
  <p class="tagline">穿梭副本、自由配裝的 Roguelite</p>
  <div class="landing-actions">
    <button class="primary" onclick={() => navigate('/game')}>進入遊戲</button>
    <button onclick={() => navigate('/playground')}>實驗室</button>
  </div>
</main>
