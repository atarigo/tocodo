<script lang="ts">
  import { ui } from './store.svelte.js';

  let box: HTMLDivElement | undefined = $state();

  // 新戰報進來時自動捲到底；往上捲就能完整回顧
  $effect(() => {
    void ui.log.length;
    if (box) box.scrollTop = box.scrollHeight;
  });
</script>

<h2>戰報</h2>
<div class="log" bind:this={box}>
  {#each ui.log as line (line.id)}
    <div class="line kind-{line.kind}">{line.text}</div>
  {/each}
  {#if ui.log.length === 0}
    <div class="line kind-system">（這裡會堆疊所有發生的事情）</div>
  {/if}
</div>
