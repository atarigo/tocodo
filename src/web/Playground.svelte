<script lang="ts">
  import { buildAttackTable, CRIT_MULTIPLIER, rollOutcome, type AttackOutcome } from '../core/attackTable.js';
  import { attackInterval } from '../core/formulas.js';
  import { createRng } from '../core/rng.js';
  import { ATTR_NAMES, type AttrKey, type Attributes } from '../core/types.js';
  import { attrRank, attrTotalSpent } from '../game/economy.js';

  const ATTR_KEYS: AttrKey[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];

  const attacker = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  const defender = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });

  function sideTotalSpent(attrs: Attributes): number {
    return ATTR_KEYS.reduce((sum, key) => sum + attrTotalSpent(attrs[key]), 0);
  }
  let defenderHasShield = $state(false);

  const table = $derived(buildAttackTable({ attacker, defender, defenderHasShield }));

  const COLORS: Record<AttackOutcome, string> = {
    落空: '#5a5f70',
    閃避: '#3fa7a0',
    躲避: '#f0c75e',
    招架: '#5b8def',
    格檔: '#7d6ee0',
    暴擊: '#e0954b',
    要害: '#e0564b',
    碾壓: '#b04bd9',
    命中: '#6fbf73',
  };

  let sampleCounts = $state<[AttackOutcome, number][] | null>(null);
  let sampleSize = $state(10000);

  // 武器大小傷（攻方）；傷害＝區間擲骰＋力量固定值。
  // 平衡（靈巧影響落點）公式未定案，暫用均勻擲骰。
  let weaponMin = $state(10);
  let weaponMax = $state(30);
  // 武器基礎出手間隔（秒）；攻速＝間隔 ÷（1＋ 60%×敏捷÷(敏捷+128)），槍類不吃敏捷
  let weaponInterval = $state(1.8);
  let agiApplies = $state(true);

  const effectiveInterval = $derived(attackInterval(weaponInterval, attacker.agi, agiApplies));

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

  /** 這些結果會造成傷害（之後招架、格檔入場時要把減傷算進去） */
  const DAMAGING: Set<AttackOutcome> = new Set(['命中', '招架', '格檔', '暴擊', '要害', '碾壓']);

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
        const raw = lo + (hi - lo) * rng() + attacker.str;
        damages.push(Math.round(outcome === '暴擊' ? raw * CRIT_MULTIPLIER : raw));
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
    } else {
      damageStats = null;
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
      <br />⏳ 待定：招架、格檔、要害、碾壓、平衡擲骰公式、暴擊倍率。
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
      <label class="pg-shield">
        <input type="checkbox" bind:checked={defenderHasShield} />
        裝備盾牌（第 3 步起會長出格檔段）
      </label>
    </div>
  </div>

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
      <span class="muted">（傷害＝區間擲骰＋力量；平衡未定案，暫用均勻擲骰；暴擊 ×{CRIT_MULTIPLIER}）</span>
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
