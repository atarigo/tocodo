<script lang="ts">
  import { resetWorld, ui } from './store.svelte.js';
  import { buyAttr, buyItem, buySkill, equipGear, equipWeapon, setSkillSlot } from './actions.js';
  import { attrRank, attrTotalSpent, attrUpgradeCost } from '../game/economy.js';
  import { ATTR_NAMES, type AttrKey, type GearSlot } from '../core/types.js';
  import { WEAPONS, getWeapon } from '../data/weapons.js';
  import { GEAR, getGear } from '../data/gear.js';
  import { SKILLS, getSkill } from '../data/skills.js';
  import { buildPlayerUnit } from '../core/character.js';
  import { attackInterval, effectiveBalance, maxHp, maxMp } from '../core/formulas.js';
  import { critWidth, dodgeWidth, evadeWidth } from '../core/attackTable.js';
  import { WORLD_EFFECTS } from '../data/worldEffects.js';
  import { MAX_SKILL_SLOTS } from '../state/model.js';

  const ATTR_KEYS: AttrKey[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];
  const GEAR_SLOTS: GearSlot[] = ['副手', '防具', '飾品'];
  const WEAPON_IDS = new Set(WEAPONS.map((w) => w.id));

  let tab = $state<'角色' | '商店' | '世界'>('角色');

  const c = $derived(ui.game.character);
  const unit = $derived(c ? buildPlayerUnit(c) : null);
  const editable = $derived(ui.phase === 'idle' && c !== null);

  const ownedWeapons = $derived(c ? c.inventory.filter((id) => WEAPON_IDS.has(id)) : []);
  const ownedGear = $derived(c ? c.inventory.filter((id) => !WEAPON_IDS.has(id)) : []);

  const shopWeapons = $derived(
    c ? WEAPONS.filter((w) => w.price !== undefined && !c.inventory.includes(w.id)) : [],
  );
  const shopGear = $derived(
    c ? GEAR.filter((g) => g.price !== undefined && !c.inventory.includes(g.id)) : [],
  );
  const shopSkills = $derived(
    c ? SKILLS.filter((s) => s.price !== undefined && !c.knownSkills.includes(s.id)) : [],
  );

  const totalSpent = $derived(
    c ? ATTR_KEYS.reduce((sum, key) => sum + attrTotalSpent(c.attrs[key]), 0) : 0,
  );

  const worldEntries = $derived([
    { name: '攻擊聖火', active: WORLD_EFFECTS.攻擊聖火 > 0, detail: `全體攻擊 +${Math.round(WORLD_EFFECTS.攻擊聖火 * 100)}%` },
    { name: '守護壁壘', active: WORLD_EFFECTS.守護壁壘 > 0, detail: `全體護甲 +${Math.round(WORLD_EFFECTS.守護壁壘 * 100)}%` },
    { name: '遺產祝福', active: WORLD_EFFECTS.遺產祝福 > 1, detail: `報酬 ×${WORLD_EFFECTS.遺產祝福}` },
  ]);

  function pct(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function selectValue(e: Event): string {
    return (e.currentTarget as HTMLSelectElement).value;
  }

  function confirmReset(): void {
    if (window.confirm('整個世界重新開始？（紀錄與角色都會消失）')) resetWorld();
  }
</script>

<nav class="panel-tabs">
  {#each ['角色', '商店', '世界'] as name (name)}
    <button class:active={tab === name} onclick={() => (tab = name as typeof tab)}>{name}</button>
  {/each}
</nav>

{#if tab === '角色'}
  {#if c && unit}
    <div class="section">
      <h2>{c.name}</h2>
      <div class="muted">
        本人最高：第 {c.highestFloor} 層｜貨幣 <strong class="gold">{c.currency.toLocaleString()}</strong>
      </div>
      {#if !editable}
        <div class="muted warn">副本進行中——配置只能在副本之間調整</div>
      {/if}
    </div>

    <div class="section">
      <h3>主屬性（0〜255）</h3>
      {#each ATTR_KEYS as key (key)}
        {@const cost = attrUpgradeCost(c.attrs[key])}
        <div class="row">
          <span class="label">{ATTR_NAMES[key]}</span>
          <span class="value">{c.attrs[key]}{#if unit.attrs[key] !== c.attrs[key]}<span class="bonus">（{unit.attrs[key]}）</span>{/if}</span>
          <span class="rank-badge rank-{attrRank(c.attrs[key])}">{attrRank(c.attrs[key])}</span>
          <button
            class="buy"
            disabled={!editable || c.currency < cost || c.attrs[key] >= 255}
            onclick={() => buyAttr(key)}
          >+1（{cost}）</button>
        </div>
      {/each}
      <div class="muted">屬性已投入：{totalSpent.toLocaleString()}</div>
    </div>

    <div class="section">
      <h3>最終數據</h3>
      <div class="grid2">
        <span>生命 {maxHp(unit.attrs.vit)}</span>
        <span>精神 {maxMp(unit.attrs.wil)}</span>
        {#if unit.weapon}
          <span>平衡 {pct(effectiveBalance(unit.weapon.balance, unit.weapon.dexAmp ? unit.attrs.dex : 0))}</span>
          <span>出手間隔 {attackInterval(unit.weapon.interval, unit.attrs.agi, unit.weapon.agiApplies).toFixed(2)}s</span>
          <span>暴擊率 {unit.weapon.kind === '槍' ? '—（槍不可暴擊）' : pct(critWidth(unit.attrs.luk))}</span>
          <span>招架率 {pct(unit.parryRate)}</span>
        {:else}
          <span class="warn">空手：沒有普攻</span>
          <span>招架率 —</span>
        {/if}
        <span>閃避 {pct(dodgeWidth(unit.attrs.agi, 0))}</span>
        <span>躲避 {pct(evadeWidth(unit.attrs.luk))}</span>
        <span>格檔率 {unit.blockRate > 0 ? pct(unit.blockRate) : '—（無盾）'}</span>
        <span>護甲值總和 {unit.armor}</span>
        <span>減傷率 {pct(unit.reductionRate)}</span>
      </div>
    </div>

    <div class="section">
      <h3>裝備</h3>
      <div class="row">
        <span class="label">武器</span>
        <select
          disabled={!editable}
          value={c.equippedWeapon ?? ''}
          onchange={(e) => equipWeapon(selectValue(e))}
        >
          <option value="">空手（沒有普攻）</option>
          {#each ownedWeapons as id (id)}
            <option value={id}>{getWeapon(id).name}（{getWeapon(id).rank}）</option>
          {/each}
        </select>
      </div>
      {#each GEAR_SLOTS as slot (slot)}
        <div class="row">
          <span class="label">{slot}</span>
          <select
            disabled={!editable}
            value={c.equippedGear[slot] ?? ''}
            onchange={(e) => equipGear(slot, selectValue(e))}
          >
            <option value="">（無）</option>
            {#each ownedGear.filter((id) => getGear(id).slot === slot) as id (id)}
              <option value={id}>{getGear(id).name}（{getGear(id).rank}）</option>
            {/each}
          </select>
        </div>
      {/each}
    </div>

    <div class="section">
      <h3>技能欄（{MAX_SKILL_SLOTS} 格，依序優先施放）</h3>
      {#each Array(MAX_SKILL_SLOTS) as _, i (i)}
        <div class="row">
          <span class="label">{i + 1}</span>
          <select
            disabled={!editable}
            value={c.skillSlots[i] ?? ''}
            onchange={(e) => setSkillSlot(i, selectValue(e))}
          >
            <option value="">（空）</option>
            {#each c.knownSkills as id (id)}
              <option value={id} disabled={c.skillSlots.includes(id) && c.skillSlots[i] !== id}>
                {getSkill(id).name}（{getSkill(id).rank}）
              </option>
            {/each}
          </select>
        </div>
      {/each}
    </div>
  {:else}
    <div class="section muted">目前沒有存活的冒險者。</div>
  {/if}
{:else if tab === '商店'}
  {#if c}
    <div class="section">
      <h2>商店</h2>
      <div class="currency">貨幣 <strong>{c.currency.toLocaleString()}</strong></div>
      <div class="muted">沒有標價的東西，商店是買不到的——去副本找。</div>
      {#if !editable}
        <div class="muted warn">副本進行中——買賣只能在副本之間</div>
      {/if}
    </div>
    {#each [
      { title: '武器', items: shopWeapons, buy: (id: string, price: number) => buyItem(id, price) },
      { title: '裝備', items: shopGear, buy: (id: string, price: number) => buyItem(id, price) },
      { title: '技能', items: shopSkills, buy: (id: string, price: number) => buySkill(id, price) },
    ] as group (group.title)}
      {#if group.items.length > 0}
        <div class="section">
          <h3>{group.title}</h3>
          {#each group.items as item (item.id)}
            <div class="row shop-row" title={item.description}>
              <span class="label">{item.name}（{item.rank}）</span>
              <button
                class="buy"
                disabled={!editable || c.currency < item.price!}
                onclick={() => group.buy(item.id, item.price!)}
              >{item.price}</button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  {:else}
    <div class="section muted">沒有角色就沒有錢包。</div>
  {/if}
{:else}
  <div class="section">
    <h3>世界效果（偉業）</h3>
    {#each worldEntries as entry (entry.name)}
      <div class="row">
        <span class="label">{entry.active ? '✦' : '・'} {entry.name}</span>
        <span class="muted">{entry.active ? entry.detail : '未觸發'}</span>
      </div>
    {/each}
  </div>
  <div class="section">
    <h3>紀錄</h3>
    <div class="muted">第 {ui.game.era} 紀元｜最深 {ui.game.records.bestFloor} 層｜累計 {ui.game.records.lives} 段人生</div>
  </div>
  <div class="section footer">
    <button class="danger" onclick={confirmReset}>重置世界</button>
  </div>
{/if}
