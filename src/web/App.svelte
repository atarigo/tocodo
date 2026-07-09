<script lang="ts">
  import { route } from './router.svelte.js';
  import Landing from './Landing.svelte';
  import RealtimeCombatPage from '../playground/RealtimeCombatPage.svelte';
  import SpecViewer from './SpecViewer.svelte';
</script>

{#if route.path === '/playground'}
  <RealtimeCombatPage />
{:else if route.path === '/spec'}
  <SpecViewer />
{:else}
  <Landing />
{/if}
