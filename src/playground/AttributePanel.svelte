<script lang="ts">
  import { ATTR_KEYS, ATTR_NAMES, RANKS, RANK_LABELS, type ActionLoadout, type Attributes, type BattleSetup, type Rank, type EnemySpawn, type EquipmentDefinition, type EquipmentLoadout, type EquipmentSlot, type ItemId, type SkillId, type WeaponDefinition } from '../core/types.js';
  import { attackInterval, maxHp, maxMp } from '../core/formulas.js';
  import {
    EQUIPMENT_SLOT_LABELS,
    equipmentDefense,
    equipmentOptionsFor,
    getEquipment,
    getOffhandWeapon,
    getWeapon,
    normalizeLoadout,
  } from '../data/equipmentCatalog.js';
  import { ITEMS, itemById } from '../data/itemCatalog.js';
  import { SKILLS, skillById } from '../data/skillCatalog.js';

  let {
    playerAttrs = $bindable(),
    enemyDifficulty = $bindable(),
    playerLoadout = $bindable(),
    actionLoadout = $bindable(),
    battleSetup,
  }: {
    playerAttrs: Attributes;
    enemyDifficulty: Rank;
    playerLoadout: EquipmentLoadout;
    actionLoadout: ActionLoadout;
    battleSetup: BattleSetup | null;
  } = $props();

  let activeTab = $state<'attrs' | 'equipment' | 'actions'>('attrs');
  const normalizedLoadout = $derived(normalizeLoadout(playerLoadout));
  const selectedWeapon = $derived(getWeapon(normalizedLoadout));
  const selectedOffhandWeapon = $derived(getOffhandWeapon(normalizedLoadout));
  const selectedOffhandItem = $derived(normalizedLoadout.offHand ? getEquipment(normalizedLoadout.offHand) : null);
  const defense = $derived(equipmentDefense(normalizedLoadout));
  const armorSlots: EquipmentSlot[] = ['head', 'body', 'legs', 'feet'];

  function updateAttr(target: 'player' | 'enemy', key: keyof Attributes, value: number): void {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    if (target === 'player') playerAttrs = { ...playerAttrs, [key]: next };
  }

  function updateEquipment(slot: EquipmentSlot, id: string): void {
    const next: EquipmentLoadout = { ...playerLoadout, [slot]: id === '' ? null : id };
    playerLoadout = normalizeLoadout(next);
  }

  function itemName(id: string | null): string {
    return id ? getEquipment(id).name : '無';
  }

  function updateSkillSlot(index: number, id: string): void {
    const skillSlots = [...actionLoadout.skillSlots];
    skillSlots[index] = id === '' ? null : (id as SkillId);
    actionLoadout = { ...actionLoadout, skillSlots };
  }

  function updateItemSlot(index: number, id: string): void {
    const itemSlots = [...actionLoadout.itemSlots];
    itemSlots[index] = id === '' ? null : (id as ItemId);
    actionLoadout = { ...actionLoadout, itemSlots };
  }

  function isWeapon(item: EquipmentDefinition | null): item is WeaponDefinition {
    return !!item && 'damage' in item;
  }

  function effectText(weapon: WeaponDefinition): string {
    const effects = [
      weapon.strApplies ? '力量' : null,
      weapon.agiApplies ? '敏捷攻速' : null,
      weapon.dexAmp ? '靈巧平衡' : null,
    ].filter(Boolean);
    return effects.length > 0 ? effects.join(' / ') : '不吃屬性';
  }

  function attackModeText(weapon: WeaponDefinition): string {
    if (weapon.projectile?.ammoType === 'arrow') return '遠程 / 箭矢';
    if (weapon.projectile?.ammoType === 'bullet') return '遠程 / 子彈';
    return '近戰 / 範圍';
  }

  function actualInterval(weapon: WeaponDefinition): string {
    return `${attackInterval(weapon.interval, playerAttrs.agi, weapon.agiApplies).toFixed(2)}s`;
  }

  function attrLine(attrs: Attributes): string {
    return ATTR_KEYS.map((key) => `${ATTR_NAMES[key]} ${attrs[key]}`).join(' / ');
  }

  function spawnHpMp(spawn: EnemySpawn): string {
    const attrs = spawn.attrs;
    if (!attrs) return '';
    return `HP ${maxHp(attrs.vit)} / MP ${maxMp(attrs.wil)}`;
  }
</script>

<div class="tabs">
  <button class:active={activeTab === 'attrs'} onclick={() => (activeTab = 'attrs')}>屬性</button>
  <button class:active={activeTab === 'equipment'} onclick={() => (activeTab = 'equipment')}>裝備</button>
  <button class:active={activeTab === 'actions'} onclick={() => (activeTab = 'actions')}>快捷</button>
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
      <label class="equip-row">
        <span>難度</span>
        <select value={enemyDifficulty} onchange={(event) => (enemyDifficulty = event.currentTarget.value as Rank)}>
          {#each RANKS as rank}
            <option value={rank}>{RANK_LABELS[rank]}</option>
          {/each}
        </select>
      </label>

      {#if battleSetup}
        <div class="derived">
          <span>{RANK_LABELS[battleSetup.difficulty ?? enemyDifficulty]}</span>
          <span>{battleSetup.encounterName ?? '未命名遭遇'}</span>
        </div>
        <div class="enemy-info-list">
          {#each battleSetup.enemies as enemy, index}
            <div class="enemy-info">
              <strong>{enemy.name ?? `敵人 ${index + 1}`}</strong>
              {#if enemy.attrs}
                <span>{spawnHpMp(enemy)}</span>
                <small>{attrLine(enemy.attrs)}</small>
              {/if}
            </div>
          {/each}
          {#if battleSetup.allies?.length}
            {#each battleSetup.allies as ally, index}
              <div class="enemy-info ally-info">
                <strong>{ally.name ?? `友方 ${index + 1}`}</strong>
                {#if ally.attrs}
                  <span>{spawnHpMp(ally)}</span>
                  <small>{attrLine(ally.attrs)}</small>
                {/if}
              </div>
            {/each}
          {/if}
          {#if battleSetup.neutrals?.length}
            {#each battleSetup.neutrals as neutral, index}
              <div class="enemy-info neutral-info">
                <strong>{neutral.name ?? `中立 ${index + 1}`}</strong>
                {#if neutral.attrs}
                  <span>{spawnHpMp(neutral)}</span>
                  <small>{attrLine(neutral.attrs)}</small>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <div class="muted-line">開始遊戲後顯示本次敵人屬性</div>
      {/if}
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
      <h2>攻擊摘要</h2>
      <div class="weapon-summary">
        <div class="summary-title">
          <span>主手</span>
          <strong>{selectedWeapon.name}</strong>
        </div>
        <div class="summary-list">
          <div><span>類型</span><strong>{attackModeText(selectedWeapon)}</strong></div>
          <div><span>雙手</span><strong>{selectedWeapon.twoHanded ? '是' : '否'}</strong></div>
          <div><span>傷害</span><strong>{selectedWeapon.damage[0]} - {selectedWeapon.damage[1]}</strong></div>
          <div><span>平衡</span><strong>{Math.round(selectedWeapon.balance * 100)}%</strong></div>
          <div><span>基礎間隔</span><strong>{selectedWeapon.interval.toFixed(2)}s</strong></div>
          <div><span>實際間隔</span><strong>{actualInterval(selectedWeapon)}</strong></div>
          <div><span>範圍</span><strong>{selectedWeapon.range}</strong></div>
          <div><span>角度</span><strong>{Math.round((selectedWeapon.arc * 180) / Math.PI)}°</strong></div>
          <div><span>招架</span><strong>{Math.round(selectedWeapon.parryRate * 100)}%</strong></div>
          <div><span>格檔</span><strong>{Math.round((selectedWeapon.blockRate ?? 0) * 100)}%</strong></div>
          <div><span>吃屬性</span><strong>{effectText(selectedWeapon)}</strong></div>
        </div>
      </div>

      <div class="weapon-summary">
        <div class="summary-title">
          <span>副手</span>
          <strong>{itemName(normalizedLoadout.offHand)}</strong>
        </div>
        {#if selectedOffhandWeapon}
          <div class="summary-list">
            <div><span>類型</span><strong>{attackModeText(selectedOffhandWeapon)}</strong></div>
            <div><span>傷害</span><strong>{selectedOffhandWeapon.damage[0]} - {selectedOffhandWeapon.damage[1]}</strong></div>
            <div><span>平衡</span><strong>{Math.round(selectedOffhandWeapon.balance * 100)}%</strong></div>
            <div><span>基礎間隔</span><strong>{selectedOffhandWeapon.interval.toFixed(2)}s</strong></div>
            <div><span>實際間隔</span><strong>{actualInterval(selectedOffhandWeapon)}</strong></div>
            <div><span>範圍</span><strong>{selectedOffhandWeapon.range}</strong></div>
            <div><span>角度</span><strong>{Math.round((selectedOffhandWeapon.arc * 180) / Math.PI)}°</strong></div>
            <div><span>招架</span><strong>{Math.round(selectedOffhandWeapon.parryRate * 100)}%</strong></div>
            <div><span>格檔</span><strong>{Math.round((selectedOffhandWeapon.blockRate ?? 0) * 100)}%</strong></div>
            <div><span>吃屬性</span><strong>{effectText(selectedOffhandWeapon)}</strong></div>
          </div>
        {:else if isWeapon(selectedOffhandItem)}
          <div class="muted-line">副手武器資料未啟用</div>
        {:else if selectedOffhandItem}
          <div class="summary-list">
            <div><span>類型</span><strong>防具</strong></div>
            <div><span>護甲</span><strong>{selectedOffhandItem.armor}</strong></div>
            <div><span>減傷</span><strong>{Math.round(selectedOffhandItem.reductionRate * 100)}%</strong></div>
            <div><span>招架</span><strong>{Math.round(selectedOffhandItem.parryRate * 100)}%</strong></div>
            <div><span>格檔</span><strong>{Math.round(selectedOffhandItem.blockRate * 100)}%</strong></div>
          </div>
        {:else}
          <div class="muted-line">未裝備副手</div>
        {/if}
      </div>
    </section>

    <section class="panel-section">
      <h2>防禦合計</h2>
      <div class="summary-list">
        <div><span>護甲</span><strong>{defense.armor}</strong></div>
        <div><span>減傷</span><strong>{Math.round(defense.reductionRate * 100)}%</strong></div>
        <div><span>招架</span><strong>{Math.round(defense.parryRate * 100)}%</strong></div>
        <div><span>格檔</span><strong>{Math.round(defense.blockRate * 100)}%</strong></div>
      </div>
    </section>
  </div>
{:else if activeTab === 'actions'}
  <div class="actions-page">
    <section class="panel-section">
      <h2>技能欄</h2>
      {#each Array(5) as _, index}
        <label class="equip-row">
          <span>{index + 1}</span>
          <select value={actionLoadout.skillSlots[index] ?? ''} onchange={(event) => updateSkillSlot(index, event.currentTarget.value)}>
            <option value="">空</option>
            {#each Object.values(SKILLS).filter((skill) => skill.id === 'heal') as skill (skill.id)}
              <option value={skill.id}>{skill.name}</option>
            {/each}
          </select>
        </label>
      {/each}
    </section>

    <section class="panel-section">
      <h2>道具欄</h2>
      {#each Array(2) as _, index}
        <label class="equip-row">
          <span>{index === 0 ? 'Q' : 'E'}</span>
          <select value={actionLoadout.itemSlots[index] ?? ''} onchange={(event) => updateItemSlot(index, event.currentTarget.value)}>
            <option value="">空</option>
            {#each Object.values(ITEMS) as item (item.id)}
              <option value={item.id}>{item.name}</option>
            {/each}
          </select>
        </label>
      {/each}
    </section>

    <section class="panel-section">
      <h2>效果摘要</h2>
      <div class="summary-list">
        <div><span>{skillById('heal').name}</span><strong>每秒 2% HP / 16s</strong></div>
        <div><span>消耗</span><strong>MP 2 / CD 20s</strong></div>
        <div><span>{itemById('smallHealthPotion').name}</span><strong>恢復 25% HP</strong></div>
        <div><span>使用</span><strong>一次戰鬥一次</strong></div>
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
  .equipment-page,
  .actions-page {
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

  .enemy-info-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .enemy-info {
    border-bottom: 1px solid var(--panel-border);
    padding-bottom: 7px;
    font-size: 12px;
  }

  .enemy-info strong,
  .enemy-info span,
  .enemy-info small {
    display: block;
  }

  .enemy-info strong {
    margin-bottom: 3px;
    font-weight: 600;
  }

  .enemy-info span {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .enemy-info small {
    margin-top: 3px;
    color: var(--muted);
    line-height: 1.45;
  }

  .ally-info strong {
    color: #6fbf73;
  }

  .neutral-info strong {
    color: #c7b98b;
  }

  .summary-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    font-size: 12px;
  }

  .weapon-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }

  .summary-title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
  }

  .summary-title strong {
    color: var(--text);
    font-weight: 600;
    text-align: right;
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

  .muted-line {
    color: var(--muted);
    font-size: 12px;
  }
</style>
