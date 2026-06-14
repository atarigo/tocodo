<script lang="ts">
  import { ATTR_KEYS, ATTR_NAMES, type Attributes } from './types.js';
  import { maxHp, maxMp } from './formulas.js';
  import { getWeapon, WEAPONS } from './weaponCatalog.js';

  let {
    playerAttrs = $bindable(),
    enemyAttrs = $bindable(),
    weaponId = $bindable(),
  }: {
    playerAttrs: Attributes;
    enemyAttrs: Attributes;
    weaponId: string;
  } = $props();

  let activeTab = $state<'attrs' | 'weapon'>('attrs');
  const selectedWeapon = $derived(getWeapon(weaponId));

  function updateAttr(target: 'player' | 'enemy', key: keyof Attributes, value: number): void {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    if (target === 'player') playerAttrs = { ...playerAttrs, [key]: next };
    else enemyAttrs = { ...enemyAttrs, [key]: next };
  }
</script>

<div class="tabs">
  <button class:active={activeTab === 'attrs'} onclick={() => (activeTab = 'attrs')}>屬性</button>
  <button class:active={activeTab === 'weapon'} onclick={() => (activeTab = 'weapon')}>武器</button>
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
{:else if activeTab === 'weapon'}
  <div class="weapon-page">
    <section class="attr-section">
      <h2>玩家武器</h2>
      <select bind:value={weaponId}>
        {#each WEAPONS as weapon (weapon.id)}
          <option value={weapon.id}>{weapon.name}</option>
        {/each}
      </select>

      <div class="weapon-stats">
        <div><span>傷害</span><strong>{selectedWeapon.damage[0]} - {selectedWeapon.damage[1]}</strong></div>
        <div><span>平衡</span><strong>{Math.round(selectedWeapon.balance * 100)}%</strong></div>
        <div><span>間隔</span><strong>{selectedWeapon.interval.toFixed(1)}s</strong></div>
        <div><span>範圍</span><strong>{selectedWeapon.range}</strong></div>
        <div><span>角度</span><strong>{Math.round((selectedWeapon.arc * 180) / Math.PI)}°</strong></div>
        <div><span>招架</span><strong>{Math.round(selectedWeapon.parryRate * 100)}%</strong></div>
      </div>
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

  .attr-page,
  .weapon-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 12px;
  }

  .weapon-page select {
    width: 100%;
    background: #15161c;
    border: 1px solid var(--panel-border);
    color: var(--text);
    border-radius: 5px;
    padding: 6px 8px;
  }

  .weapon-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    margin-top: 12px;
    font-size: 12px;
  }

  .weapon-stats div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--panel-border);
    padding-bottom: 4px;
  }

  .weapon-stats span {
    color: var(--muted);
  }

  .weapon-stats strong {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
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
