<script lang="ts">
  import { route } from './router.svelte.js';
  import Landing from './Landing.svelte';
  import RealtimeCombatPage from '../playground/RealtimeCombatPage.svelte';
</script>

{#if route.path === '/playground'}
  <RealtimeCombatPage />
{:else}
  <Landing />
{/if}
