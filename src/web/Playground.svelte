<script lang="ts">
  import { buildAttackTable, rollOutcome, type AttackOutcome } from '../core/attackTable.js';
  import { createRng } from '../core/rng.js';
  import { ATTR_NAMES, type AttrKey, type Attributes } from '../core/types.js';

  const ATTR_KEYS: AttrKey[] = ['str', 'vit', 'agi', 'dex', 'wil', 'luk'];

  const attacker = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  const defender = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
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

  function runSample(): void {
    const rng = createRng(Date.now() >>> 0);
    const counts = new Map<AttackOutcome, number>();
    for (let i = 0; i < sampleSize; i++) {
      const outcome = rollOutcome(table, rng);
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    }
    sampleCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]);
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
      目前進度：<strong>第 0 步——空表</strong>。沒有落空、閃避、暴擊，每一刀都實打實命中，
      所以下面的屬性怎麼調都不會影響這條 bar。這是基準線。
    </p>
  </div>

  <div class="pg-inputs">
    <div class="pg-side">
      <h3>攻方</h3>
      {#each ATTR_KEYS as key (key)}
        <label class="pg-attr">
          <span>{ATTR_NAMES[key]}</span>
          <input type="range" min="1" max="100" bind:value={attacker[key]} />
          <input type="number" min="1" max="999" bind:value={attacker[key]} />
        </label>
      {/each}
    </div>
    <div class="pg-side">
      <h3>守方</h3>
      {#each ATTR_KEYS as key (key)}
        <label class="pg-attr">
          <span>{ATTR_NAMES[key]}</span>
          <input type="range" min="1" max="100" bind:value={defender[key]} />
          <input type="number" min="1" max="999" bind:value={defender[key]} />
        </label>
      {/each}
      <label class="pg-shield">
        <input type="checkbox" bind:checked={defenderHasShield} />
        裝備盾牌（第 3 步起會長出格檔段）
      </label>
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
  </div>
</div>
