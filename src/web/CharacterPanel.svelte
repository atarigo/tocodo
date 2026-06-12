<script lang="ts">
  import { resetWorld, ui } from './store.svelte.js';
  import { buyAttr, buyItem, buySkill, equipGear, equipWeapon, setSkillSlot } from './actions.js';
  import { attrPrice } from '../game/economy.js';
  import { ATTR_NAMES, type AttrKey } from '../core/types.js';
  import { WEAPONS, getWeapon } from '../data/weapons.js';
  import { GEAR, getGear, type GearSlot } from '../data/gear.js';
  import { SKILLS, getSkill } from '../data/skills.js';
  import { buildPlayerUnit } from '../core/character.js';
  import { deriveStats } from '../core/attributes.js';
  import { WORLD_EFFECTS } from '../data/worldEffects.js';
  import { MAX_SKILL_SLOTS } from '../state/model.js';

  const ATTR_KEYS: AttrKey[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];
  const GEAR_SLOTS: GearSlot[] = ['防具', '副手', '飾品'];
  const WEAPON_IDS = new Set(WEAPONS.map((w) => w.id));

  const c = $derived(ui.game.character);
  const unit = $derived(c ? buildPlayerUnit(c) : null);
  const stats = $derived(unit ? deriveStats(unit.attrs) : null);
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

  const attackInterval = $derived(
    unit
      ? unit.weapon.interval / (unit.weapon.agiSpeed ? 1 + unit.attrs.agi * 0.02 : 1)
      : 0,
  );

  const worldEntries = $derived([
    { name: '攻擊聖火', active: WORLD_EFFECTS.攻擊聖火 > 0, detail: `全體攻擊 +${Math.round(WORLD_EFFECTS.攻擊聖火 * 100)}%` },
    { name: '守護壁壘', active: WORLD_EFFECTS.守護壁壘 > 0, detail: `全體防禦 +${Math.round(WORLD_EFFECTS.守護壁壘 * 100)}%` },
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

{#if c && unit && stats}
  <div class="section">
    <h2>{c.name}</h2>
    <div class="currency">貨幣 <strong>{c.currency}</strong></div>
    <div class="muted">本人最高紀錄：第 {c.highestFloor} 層</div>
    {#if !editable}
      <div class="muted warn">副本進行中——配置只能在副本之間調整</div>
    {/if}
  </div>

  <div class="section">
    <h3>主屬性</h3>
    {#each ATTR_KEYS as key (key)}
      {@const cost = attrPrice(key, c.attrs[key])}
      <div class="row">
        <span class="label">{ATTR_NAMES[key]}</span>
        <span class="value">{c.attrs[key]}{#if unit.attrs[key] !== c.attrs[key]}<span class="bonus">（{unit.attrs[key]}）</span>{/if}</span>
        <button
          class="buy"
          disabled={!editable || c.currency < cost}
          onclick={() => buyAttr(key)}
        >+1（{cost}）</button>
      </div>
    {/each}
  </div>

  <div class="section">
    <h3>衍生值</h3>
    <div class="grid2">
      <span>生命 {stats.maxHp}</span>
      <span>精神 {stats.maxMp}（+{stats.mpRegen.toFixed(1)}/s）</span>
      <span>攻速 {attackInterval.toFixed(2)}s</span>
      <span>防禦 −{unit.defense.flat}／{pct(unit.defense.pct)}</span>
      <span>閃避 {pct(stats.dodge)}</span>
      <span>招架 {pct(stats.parry)}</span>
      <span>躲避 {pct(stats.luckyEvade)}</span>
      <span>暴擊 {pct(stats.critChance)}</span>
      <span>要害 {pct(stats.vitalChance)}</span>
      <span>抵抗 {pct(stats.statusResist)}</span>
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
        <option value="">空手</option>
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
    <h3>技能欄（依序優先施放）</h3>
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

  <div class="section">
    <h3>商店</h3>
    <div class="muted">沒有標價的東西，商店是買不到的。</div>
    {#each [
      { title: '武器', items: shopWeapons, buy: (id: string, price: number) => buyItem(id, price) },
      { title: '裝備', items: shopGear, buy: (id: string, price: number) => buyItem(id, price) },
      { title: '技能', items: shopSkills, buy: (id: string, price: number) => buySkill(id, price) },
    ] as group (group.title)}
      {#if group.items.length > 0}
        <h4>{group.title}</h4>
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
      {/if}
    {/each}
  </div>
{/if}

<div class="section">
  <h3>世界效果（偉業）</h3>
  {#each worldEntries as entry (entry.name)}
    <div class="row">
      <span class="label">{entry.active ? '✦' : '・'} {entry.name}</span>
      <span class="muted">{entry.active ? entry.detail : '未觸發'}</span>
    </div>
  {/each}
</div>

<div class="section footer">
  <button class="danger" onclick={confirmReset}>重置世界</button>
</div>
