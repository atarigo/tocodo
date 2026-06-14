<script lang="ts">
  import { ATTR_KEYS, ATTR_NAMES, type Attributes, type EquipmentLoadout, type EquipmentSlot } from './types.js';
  import { maxHp, maxMp } from './formulas.js';
  import {
    EQUIPMENT_SLOT_LABELS,
    equipmentDefense,
    equipmentOptionsFor,
    getEquipment,
    getWeapon,
    normalizeLoadout,
  } from './equipmentCatalog.js';

  let {
    playerAttrs = $bindable(),
    enemyAttrs = $bindable(),
    playerLoadout = $bindable(),
  }: {
    playerAttrs: Attributes;
    enemyAttrs: Attributes;
    playerLoadout: EquipmentLoadout;
  } = $props();

  let activeTab = $state<'attrs' | 'equipment'>('attrs');
  const normalizedLoadout = $derived(normalizeLoadout(playerLoadout));
  const selectedWeapon = $derived(getWeapon(normalizedLoadout));
  const defense = $derived(equipmentDefense(normalizedLoadout));
  const armorSlots: EquipmentSlot[] = ['head', 'body', 'legs', 'feet'];

  function updateAttr(target: 'player' | 'enemy', key: keyof Attributes, value: number): void {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    if (target === 'player') playerAttrs = { ...playerAttrs, [key]: next };
    else enemyAttrs = { ...enemyAttrs, [key]: next };
  }

  function updateEquipment(slot: EquipmentSlot, id: string): void {
    const next: EquipmentLoadout = { ...playerLoadout, [slot]: id === '' ? null : id };
    playerLoadout = normalizeLoadout(next);
  }

  function itemName(id: string | null): string {
    return id ? getEquipment(id).name : '無';
  }
</script>

<div class="tabs">
  <button class:active={activeTab === 'attrs'} onclick={() => (activeTab = 'attrs')}>屬性</button>
  <button class:active={activeTab === 'equipment'} onclick={() => (activeTab = 'equipment')}>裝備</button>
</div>

{#if activeTab === 'attrs'}
  <div class="attr-page">
    <section class="panel-section">
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

    <section class="panel-section">
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
{:else if activeTab === 'equipment'}
  <div class="equipment-page">
    <section class="panel-section">
      <h2>角色裝備</h2>

      <label class="equip-row">
        <span>{EQUIPMENT_SLOT_LABELS.mainHand}</span>
        <select value={normalizedLoadout.mainHand ?? ''} onchange={(event) => updateEquipment('mainHand', event.currentTarget.value)}>
          {#each equipmentOptionsFor('mainHand') as item (item.id)}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
      </label>

      <label class="equip-row">
        <span>{EQUIPMENT_SLOT_LABELS.offHand}</span>
        <select
          disabled={selectedWeapon.twoHanded}
          value={normalizedLoadout.offHand ?? ''}
          onchange={(event) => updateEquipment('offHand', event.currentTarget.value)}
        >
          <option value="">{selectedWeapon.twoHanded ? '雙手武器占用' : '無'}</option>
          {#each equipmentOptionsFor('offHand') as item (item.id)}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
      </label>

      {#each armorSlots as slot}
        <label class="equip-row">
          <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
          <select value={normalizedLoadout[slot] ?? ''} onchange={(event) => updateEquipment(slot, event.currentTarget.value)}>
            <option value="">無</option>
            {#each equipmentOptionsFor(slot) as item (item.id)}
              <option value={item.id}>{item.name}</option>
            {/each}
          </select>
        </label>
      {/each}
    </section>

    <section class="panel-section">
      <h2>裝備摘要</h2>
      <div class="summary-list">
        <div><span>主手</span><strong>{itemName(normalizedLoadout.mainHand)}</strong></div>
        <div><span>副手</span><strong>{itemName(normalizedLoadout.offHand)}</strong></div>
        <div><span>傷害</span><strong>{selectedWeapon.damage[0]} - {selectedWeapon.damage[1]}</strong></div>
        <div><span>平衡</span><strong>{Math.round(selectedWeapon.balance * 100)}%</strong></div>
        <div><span>間隔</span><strong>{selectedWeapon.interval.toFixed(1)}s</strong></div>
        <div><span>範圍</span><strong>{selectedWeapon.range}</strong></div>
        <div><span>角度</span><strong>{Math.round((selectedWeapon.arc * 180) / Math.PI)}°</strong></div>
        <div><span>護甲</span><strong>{defense.armor}</strong></div>
        <div><span>減傷</span><strong>{Math.round(defense.reductionRate * 100)}%</strong></div>
        <div><span>招架</span><strong>{Math.round(defense.parryRate * 100)}%</strong></div>
        <div><span>格檔</span><strong>{Math.round(defense.blockRate * 100)}%</strong></div>
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
  .equipment-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 12px;
  }

  .panel-section h2 {
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

  .attr-row input[type='number'],
  .equip-row select {
    background: #15161c;
    border: 1px solid var(--panel-border);
    color: var(--text);
    border-radius: 4px;
    padding: 3px 5px;
    font-size: 12px;
  }

  .attr-row input[type='number'] {
    width: 54px;
    font-variant-numeric: tabular-nums;
  }

  .equip-row {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .equip-row select {
    width: 100%;
  }

  .equip-row select:disabled {
    opacity: 0.55;
  }

  .summary-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    font-size: 12px;
  }

  .summary-list div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--panel-border);
    padding-bottom: 4px;
  }

  .summary-list span {
    color: var(--muted);
  }

  .summary-list strong {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
