<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BLOCK_DAMAGE_REDUCTION,
    buildAttackTable,
    CRIT_MULTIPLIER,
    PARRY_DAMAGE_REDUCTION,
    resolveDamage,
    rollOutcome,
    type AttackOutcome,
  } from '../core/attackTable.js';
  import { attackInterval, balanceRoll, effectiveBalance } from '../core/formulas.js';
  import { createRng } from '../core/rng.js';
  import { ATTR_NAMES, type AttrKey, type Attributes } from '../core/types.js';
  import { attrRank, attrTotalSpent } from '../game/economy.js';

  const ATTR_KEYS: AttrKey[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];

  const attacker = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  const defender = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });

  function sideTotalSpent(attrs: Attributes): number {
    return ATTR_KEYS.reduce((sum, key) => sum + attrTotalSpent(attrs[key]), 0);
  }

  // 進場先跑一次，畫面就有初始值
  onMount(() => runSample());
  // 率來自裝備（屬性不提供）：招架＝武器（5〜25%）、格檔＝盾牌（30〜45%，0＝沒有盾）
  let parryRate = $state(15);
  let blockRate = $state(0);
  // 攻擊宣告：每次攻擊宣告自己適用哪些段（法術不可被招架、槍不可暴擊、頭目普攻帶碾壓…）
  let canCrit = $state(true);
  let crushRate = $state(0);
  let canBeParried = $state(true);
  let canBeBlocked = $state(true);
  // 真傷：第一階段有過就打固定值，不計增傷、防禦、折減
  let trueDamageMode = $state(false);
  let trueDamageValue = $state(15);
  // 守方防禦數值：減算（防具總和）與減成（防禦倍率）
  let defenseFlat = $state(0);
  let defenseReduction = $state(0);

  const table = $derived(
    buildAttackTable({
      attacker,
      defender,
      defenderParryRate: parryRate / 100,
      defenderBlockRate: blockRate / 100,
      attackerCanCrit: canCrit,
      attackerCrushRate: crushRate / 100,
      canBeParried,
      canBeBlocked,
    }),
  );

  const COLORS: Record<AttackOutcome, string> = {
    閃避: '#3fa7a0',
    躲避: '#f0c75e',
    招架: '#5b8def',
    格檔: '#7d6ee0',
    暴擊: '#e0954b',
    碾壓: '#b04bd9',
    命中: '#6fbf73',
  };

  let sampleCounts = $state<[AttackOutcome, number][] | null>(null);
  let sampleSize = $state(10000);

  // 武器大小傷（攻方）；傷害＝平衡擲骰＋力量固定值。
  let weaponMin = $state(10);
  let weaponMax = $state(30);
  // 武器自帶平衡（%）；靈巧加強、上限 80%
  let weaponBalance = $state(40);
  // 武器基礎出手間隔（秒）；攻速＝間隔 ÷（1＋ 60%×敏捷÷(敏捷+128)），槍類不吃敏捷
  let weaponInterval = $state(1.8);
  let agiApplies = $state(true);

  const effectiveInterval = $derived(attackInterval(weaponInterval, attacker.agi, agiApplies));
  const balance = $derived(effectiveBalance(weaponBalance / 100, attacker.dex));

  interface DamageStats {
    hits: number;
    total: number;
    mean: number;
    min: number;
    max: number;
    median: number;
    dps: number;
  }
  let damageStats = $state<DamageStats | null>(null);
  /** 傷害分布直方圖（正規化高度 0〜1） */
  let histogram = $state<number[] | null>(null);
  const HISTO_BINS = 24;

  /** 這些結果會造成傷害（含打折後的） */
  const DAMAGING: Set<AttackOutcome> = new Set(['命中', '招架', '格檔', '暴擊', '碾壓']);

  function runSample(): void {
    const rng = createRng(Date.now() >>> 0);
    const counts = new Map<AttackOutcome, number>();
    const damages: number[] = [];
    const lo = Math.min(weaponMin, weaponMax);
    const hi = Math.max(weaponMin, weaponMax);
    for (let i = 0; i < sampleSize; i++) {
      const outcome = rollOutcome(table, rng);
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
      if (DAMAGING.has(outcome)) {
        if (trueDamageMode) {
          // 真傷：骰到什麼都算命中，固定值
          damages.push(trueDamageValue);
        } else {
          const base = balanceRoll(rng, lo, hi, balance) + attacker.str;
          damages.push(
            resolveDamage(outcome, base, {
              flat: defenseFlat,
              multiplier: 1 - defenseReduction / 100,
            }),
          );
        }
      }
    }
    sampleCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    if (damages.length > 0) {
      damages.sort((a, b) => a - b);
      const mid = Math.floor(damages.length / 2);
      const total = damages.reduce((sum, d) => sum + d, 0);
      damageStats = {
        hits: damages.length,
        total,
        mean: total / damages.length,
        min: damages[0],
        max: damages[damages.length - 1],
        median: damages.length % 2 === 0 ? (damages[mid - 1] + damages[mid]) / 2 : damages[mid],
        // 每次出手（不論結果）都消耗一個出手間隔
        dps: total / (sampleSize * effectiveInterval),
      };
      const span = damages[damages.length - 1] - damages[0];
      const counts = new Array<number>(HISTO_BINS).fill(0);
      for (const d of damages) {
        const bin = span === 0 ? 0 : Math.min(HISTO_BINS - 1, Math.floor(((d - damages[0]) / span) * HISTO_BINS));
        counts[bin]++;
      }
      const peak = Math.max(...counts);
      histogram = counts.map((c) => c / peak);
    } else {
      damageStats = null;
      histogram = null;
    }
  }
</script>

<div class="playground">
  <div class="pg-header">
    <h2>攻擊表實驗室</h2>
    <p class="muted">
      單骰攻擊表：先用攻守雙方數值「組表」，再擲一顆骰決定結果。
      這裡跟正式遊戲完全隔離，我們一段一段加、邊看邊討論，定案後才接進戰鬥引擎。
    </p>
    <p class="step-note">
      原則：所有段都由屬性或裝備提供，<strong>沒有預設數值</strong>，屬性 0〜255、起始 10，全部歸零＝100% 命中。
      <br />✅ 躲避＝ 12% × 守方幸運 ÷（幸運＋128），飽和曲線、不可壓縮（128 → 6%、255 → 8%）。
      <br />✅ 暴擊＝ 30% × 攻方幸運 ÷ 255，線性（會被防禦段擠壓，有天然反制）；傷害 ×1.5（暫定）。
      <br />✅ 攻速＝武器間隔 ÷（1 ＋ 60% × 敏捷 ÷（敏捷＋128））；槍類不吃敏捷。
      <br />✅ 閃避＝（40% × 守方敏捷 ÷ 255）×（1 − 0.5 × 攻方靈巧 ÷ 255）：靈巧最多壓掉一半，防禦永遠還在。
      <br />🧪 平衡（試行）＝武器平衡 ×（1＋放大率），上限 80%；
      放大率＝ 60% × 靈巧 ÷（靈巧＋128），低靈巧每點更有效（64 → +20%、128 → +30%、255 → 約 +40%）。
      傷害以「最小傷＋範圍×平衡」為中心呈鐘形分佈（標準差＝範圍×0.2，暫定）。
      <br />✅ 招架＝武器提供 5〜25%（屬性不提供），減傷 30%，無法阻止效果發動。
      <br />✅ 格檔＝盾牌提供 30〜45%（0＝無盾），固定減傷 60%；可擋單體鎖定效果（範圍擋不住）——待 buff/debuff 系統。
      <br />✅ 暴擊倍率定案 ×1.5；要害已移除；槍不可暴擊（槍手的幸運只剩躲避）。
      <br />✅ 碾壓＝頭目普攻限定，統一預設 15%（各頭目可自訂）、傷害 ×2；防禦堆高時在命中歸零後第一個被擠出。
      <br />✅ 兩階段：骰表出標籤 → 增傷（暴擊/碾壓）→ 減算（防具總和）→ 減成（防禦倍率）→ 招架/格檔折減。
      <br />✅ 真傷＝骰到什麼都算命中，打固定值，不計增傷、防禦與折減。
      <br />⏳ 待定：鐘形寬度、各段適用預設表（近戰技/射擊/法術）正式確認。
    </p>
  </div>

  <div class="pg-inputs">
    <div class="pg-side">
      <h3>攻方</h3>
      {#each ATTR_KEYS as key (key)}
        <label class="pg-attr">
          <span>{ATTR_NAMES[key]}</span>
          <input type="range" min="0" max="255" bind:value={attacker[key]} />
          <input type="number" min="0" max="255" bind:value={attacker[key]} />
          <span class="rank-badge rank-{attrRank(attacker[key])}">{attrRank(attacker[key])}</span>
        </label>
      {/each}
      <div class="muted">已投入點數：{sideTotalSpent(attacker).toLocaleString()}</div>
      <div class="pg-flags">
        <label><input type="checkbox" bind:checked={canCrit} /> 可暴擊（槍＝否）</label>
        <label><input type="checkbox" bind:checked={canBeParried} /> 可被招架（射擊、法術＝否）</label>
        <label><input type="checkbox" bind:checked={canBeBlocked} /> 可被格檔</label>
        <label class="pg-attr">
          <span>碾壓率%</span>
          <input type="range" min="0" max="25" bind:value={crushRate} />
          <input type="number" min="0" max="100" bind:value={crushRate} />
          <span class="muted">頭目普攻限定，預設 15、×2</span>
        </label>
        <label><input type="checkbox" bind:checked={trueDamageMode} /> 真傷（固定值
          <input class="pg-inline-num" type="number" min="1" max="9999" bind:value={trueDamageValue} />
          ，骰到什麼都算命中，不計增傷與防禦）</label>
      </div>
    </div>
    <div class="pg-side">
      <h3>守方</h3>
      {#each ATTR_KEYS as key (key)}
        <label class="pg-attr">
          <span>{ATTR_NAMES[key]}</span>
          <input type="range" min="0" max="255" bind:value={defender[key]} />
          <input type="number" min="0" max="255" bind:value={defender[key]} />
          <span class="rank-badge rank-{attrRank(defender[key])}">{attrRank(defender[key])}</span>
        </label>
      {/each}
      <div class="muted">已投入點數：{sideTotalSpent(defender).toLocaleString()}</div>
      <label class="pg-attr pg-equip">
        <span>招架率%</span>
        <input type="range" min="0" max="25" bind:value={parryRate} />
        <input type="number" min="0" max="100" bind:value={parryRate} />
        <span class="muted">武器提供，減傷 {PARRY_DAMAGE_REDUCTION * 100}%</span>
      </label>
      <label class="pg-attr pg-equip">
        <span>格檔率%</span>
        <input type="range" min="0" max="45" bind:value={blockRate} />
        <input type="number" min="0" max="100" bind:value={blockRate} />
        <span class="muted">盾牌提供（0＝無盾），減傷 {BLOCK_DAMAGE_REDUCTION * 100}%</span>
      </label>
      <label class="pg-attr pg-equip">
        <span>防具總和</span>
        <input type="range" min="0" max="200" bind:value={defenseFlat} />
        <input type="number" min="0" max="9999" bind:value={defenseFlat} />
        <span class="muted">減算（−）</span>
      </label>
      <label class="pg-attr pg-equip">
        <span>減成%</span>
        <input type="range" min="0" max="80" bind:value={defenseReduction} />
        <input type="number" min="0" max="100" bind:value={defenseReduction} />
        <span class="muted">防禦倍率（buff/debuff/裝備效果）</span>
      </label>
    </div>
  </div>

  <div class="pg-bottom">
  <div class="pg-cost">
    <h3>屬性升級花費（起始 10）</h3>
    <table>
      <thead>
        <tr><th>區間（階級）</th><th>每級費用</th><th>區間小計</th><th>累計</th></tr>
      </thead>
      <tbody>
        <tr><td>11〜50（D）</td><td>100</td><td>4,000</td><td>4,000</td></tr>
        <tr><td>51〜100（C）</td><td>300</td><td>15,000</td><td>19,000</td></tr>
        <tr><td>101〜150（B）</td><td>1,000</td><td>50,000</td><td>69,000</td></tr>
        <tr><td>151〜200（A）</td><td>2,000</td><td>100,000</td><td>169,000</td></tr>
        <tr><td>201〜255（S）</td><td>5,000</td><td>275,000</td><td><strong>444,000</strong></td></tr>
      </tbody>
    </table>
    <div class="muted">單屬性點滿 444,000；六邊形全滿 2,664,000。</div>
  </div>
  <div class="pg-histo">
    <h3>傷害分布（中心＝平衡位置）</h3>
    {#if histogram && damageStats}
      <div class="histo">
        {#each histogram as height, i (i)}
          <div class="histo-bar" style="height: {Math.max(2, height * 100)}%"></div>
        {/each}
      </div>
      <div class="histo-axis">
        <span>{damageStats.min}</span>
        <span>{damageStats.max}</span>
      </div>
    {:else}
      <div class="muted">（按「擲骰」後顯示）</div>
    {/if}
  </div>
  </div>

  <div class="pg-table">
    <h3>攻擊表</h3>
    <div class="bar">
      {#each table as segment (segment.outcome)}
        {#if segment.width > 0}
          <div
            class="bar-segment"
            style="width: {segment.width * 100}%; background: {COLORS[segment.outcome]}"
            title="{segment.outcome} {(segment.width * 100).toFixed(1)}%"
          >
            {#if segment.width > 0.06}
              {segment.outcome} {(segment.width * 100).toFixed(1)}%
            {/if}
          </div>
        {/if}
      {/each}
    </div>
    <div class="legend">
      {#each table.filter((s) => s.width > 0) as segment (segment.outcome)}
        <span class="legend-item">
          <span class="swatch" style="background: {COLORS[segment.outcome]}"></span>
          {segment.outcome}：{(segment.width * 100).toFixed(2)}%
        </span>
      {/each}
    </div>
  </div>

  <div class="pg-sample">
    <h3>擲骰驗證</h3>
    <div class="sample-controls">
      <label>武器大小傷
        <input type="number" min="0" max="9999" bind:value={weaponMin} />
        〜
        <input type="number" min="0" max="9999" bind:value={weaponMax} />
      </label>
      <label>武器平衡（%）
        <input type="number" min="0" max="80" bind:value={weaponBalance} />
      </label>
      <span class="muted">實際平衡 {(balance * 100).toFixed(0)}%（靈巧加強，上限 80%）；暴擊 ×{CRIT_MULTIPLIER}</span>
    </div>
    <div class="sample-controls">
      <label>武器出手間隔（秒）
        <input type="number" min="0.1" max="10" step="0.1" bind:value={weaponInterval} />
      </label>
      <label>
        <input type="checkbox" bind:checked={agiApplies} />
        攻速吃敏捷（槍類不吃）
      </label>
      <span class="muted">實際間隔 {effectiveInterval.toFixed(2)}s</span>
    </div>
    <div class="sample-controls">
      <input type="number" min="100" max="1000000" step="100" bind:value={sampleSize} />
      <button onclick={runSample}>擲 {sampleSize} 次</button>
    </div>
    {#if sampleCounts}
      <div class="legend">
        {#each sampleCounts as [outcome, count] (outcome)}
          <span class="legend-item">
            <span class="swatch" style="background: {COLORS[outcome]}"></span>
            {outcome}：{count}（{((count / sampleSize) * 100).toFixed(2)}%）
          </span>
        {/each}
      </div>
    {/if}
    {#if damageStats}
      <div class="legend damage-stats">
        <span class="legend-item">造成傷害次數：{damageStats.hits}</span>
        <span class="legend-item">總傷害：{damageStats.total.toLocaleString()}</span>
        <span class="legend-item">平均：{damageStats.mean.toFixed(1)}</span>
        <span class="legend-item">中位數：{damageStats.median}</span>
        <span class="legend-item">最低：{damageStats.min}</span>
        <span class="legend-item">最高：{damageStats.max}</span>
        <span class="legend-item">每秒傷害：{damageStats.dps.toFixed(1)}</span>
      </div>
    {/if}
  </div>
</div>
