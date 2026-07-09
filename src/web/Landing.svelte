<script lang="ts">
  import { navigate } from './router.svelte.js';
</script>

<main class="landing">
  <h1>世界</h1>
  <p class="tagline">穿梭副本、自由配裝的 Roguelite</p>
  <div class="landing-actions">
    <button class="primary" onclick={() => navigate('/playground')}>進入遊戲</button>
    <button onclick={() => navigate('/spec')}>瀏覽規格</button>
  </div>
</main>
