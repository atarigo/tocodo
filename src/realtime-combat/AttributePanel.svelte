<script lang="ts">
  import { ATTR_KEYS, ATTR_NAMES, type Attributes } from './types.js';
  import { maxHp, maxMp } from './formulas.js';

  let {
    playerAttrs = $bindable(),
    enemyAttrs = $bindable(),
  }: {
    playerAttrs: Attributes;
    enemyAttrs: Attributes;
  } = $props();

  let activeTab = $state<'attrs'>('attrs');

  function updateAttr(target: 'player' | 'enemy', key: keyof Attributes, value: number): void {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    if (target === 'player') playerAttrs = { ...playerAttrs, [key]: next };
    else enemyAttrs = { ...enemyAttrs, [key]: next };
  }
</script>

<div class="tabs">
  <button class:active={activeTab === 'attrs'} onclick={() => (activeTab = 'attrs')}>屬性</button>
</div>

{#if activeTab === 'attrs'}
  <div class="attr-page">
    <section class="attr-section player">
      <h2>玩家</h2>
      <div class="derived">
        <span>HP {maxHp(playerAttrs.vit)}</span>
        <span>MP {maxMp(playerAttrs.wil)}</span>
      </div>
      {#each ATTR_KEYS as key}
        <label class="attr-row">
          <span>{ATTR_NAMES[key]}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={playerAttrs[key]}
            oninput={(event) => updateAttr('player', key, Number(event.currentTarget.value))}
          />
          <input
            type="number"
            min="0"
            max="255"
            value={playerAttrs[key]}
            oninput={(event) => updateAttr('player', key, Number(event.currentTarget.value))}
          />
        </label>
      {/each}
    </section>

    <section class="attr-section enemy">
      <h2>敵方共用</h2>
      <div class="derived">
        <span>HP {maxHp(enemyAttrs.vit)}</span>
        <span>MP {maxMp(enemyAttrs.wil)}</span>
      </div>
      {#each ATTR_KEYS as key}
        <label class="attr-row">
          <span>{ATTR_NAMES[key]}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={enemyAttrs[key]}
            oninput={(event) => updateAttr('enemy', key, Number(event.currentTarget.value))}
          />
          <input
            type="number"
            min="0"
            max="255"
            value={enemyAttrs[key]}
            oninput={(event) => updateAttr('enemy', key, Number(event.currentTarget.value))}
          />
        </label>
      {/each}
    </section>
  </div>
{/if}

<style>
  .tabs {
    display: flex;
    gap: 6px;
    padding: 8px 8px 0;
  }

  .tabs button {
    flex: 0 0 auto;
    padding: 5px 12px;
    font-size: 12px;
  }

  .tabs button.active {
    border-color: var(--accent-2);
    color: var(--accent-2);
  }

  .attr-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 12px;
  }

  .attr-section h2 {
    margin: 0 0 8px;
    color: var(--accent-2);
    font-size: 14px;
  }

  .derived {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .attr-row {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 54px;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .attr-row input[type='range'] {
    width: 100%;
  }

  .attr-row input[type='number'] {
    width: 54px;
    background: #15161c;
    border: 1px solid var(--panel-border);
    color: var(--text);
    border-radius: 4px;
    padding: 3px 5px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
