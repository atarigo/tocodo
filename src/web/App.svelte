<script lang="ts">
  import { route } from './router.svelte.js';
  import Landing from './Landing.svelte';
  import GamePage from './GamePage.svelte';
  import PlaygroundPage from './PlaygroundPage.svelte';
</script>

{#if route.path === '/game'}
  <GamePage />
{:else if route.path === '/playground'}
  <PlaygroundPage />
{:else}
  <Landing />
{/if}
