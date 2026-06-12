<script lang="ts">
  import { pushLog, ui } from './store.svelte.js';
  import { playBattle } from './playback.js';
  import { continueRun, enterDungeon, finishBattle, newLife, retreat } from './actions.js';
  import { startingFloor } from '../core/dungeon.js';
  import type { BattleEvent } from '../core/combat.js';

  let playerDot: HTMLDivElement | undefined = $state();
  let enemyDot: HTMLDivElement | undefined = $state();
  let nameInput = $state('');

  const character = $derived(ui.game.character);
  const playerHpPct = $derived(
    ui.battle ? Math.max(0, (ui.hpView.player / ui.battle.playerMaxHp) * 100) : 100,
  );
  const enemyHpPct = $derived(
    ui.battle ? Math.max(0, (ui.hpView.enemy / ui.battle.enemyMaxHp) * 100) : 100,
  );

  function flash(el: HTMLDivElement | undefined, cls: string): void {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 強制 reflow，讓同名動畫能重新觸發
    el.classList.add(cls);
  }

  function handleEvent(ev: BattleEvent): void {
    pushLog(ev.text, ev.kind);
    const target = ev.side === 'player' ? playerDot : ev.side === 'enemy' ? enemyDot : undefined;
    const other = ev.side === 'player' ? enemyDot : ev.side === 'enemy' ? playerDot : undefined;

    switch (ev.kind) {
      case 'hurt':
        flash(other, 'anim-attack');
        flash(target, 'anim-hit');
        break;
      case 'dot':
        flash(target, 'anim-hit');
        break;
      case 'miss':
        flash(other, 'anim-attack');
        flash(target, 'anim-dodge');
        break;
      case 'cast':
        flash(target, 'anim-cast');
        break;
      case 'heal':
        flash(target, 'anim-heal');
        break;
      case 'death':
        target?.classList.add('dead');
        break;
      default:
        break;
    }
    if (ev.hpAfter !== undefined && (ev.side === 'player' || ev.side === 'enemy')) {
      ui.hpView[ev.side] = ev.hpAfter;
    }
  }

  $effect(() => {
    const battle = ui.battle;
    if (!battle || ui.phase !== 'battle') return;
    playerDot?.classList.remove('dead');
    enemyDot?.classList.remove('dead');
    return playBattle(battle.result, {
      onEvent: handleEvent,
      onDone: finishBattle,
      // interval callback 內才讀取，不會被 $effect 追蹤成依賴
      getSpeed: () => ui.speed,
    });
  });
</script>

<div class="stage">
  {#if !character}
    <div class="creation">
      {#if ui.phase === 'dead'}
        <p class="death-note">上一段人生已經結束。貨幣、裝備、技能都沒有留下——那是另一個人生了。</p>
      {/if}
      <h2>建立新的人生</h2>
      <input placeholder="冒險者之名" bind:value={nameInput} maxlength="12" />
      <button class="primary" onclick={() => newLife(nameInput)}>踏入血腥都市</button>
    </div>
  {:else}
    <div class="arena">
      <div class="fighter">
        <div class="hp-bar"><div class="hp-fill player-hp" style="width:{playerHpPct}%"></div></div>
        <div class="dot player-dot" bind:this={playerDot}></div>
        <div class="fighter-name">{character.name}</div>
        {#if ui.battle}
          <div class="hp-num">{ui.hpView.player} / {ui.battle.playerMaxHp}</div>
        {/if}
      </div>

      <div class="vs">
        {#if ui.run}
          <span class="floor-label">第 {ui.run.floor} 層</span>
        {:else}
          <span class="floor-label idle">血腥都市</span>
        {/if}
      </div>

      <div class="fighter">
        {#if ui.battle}
          <div class="hp-bar"><div class="hp-fill enemy-hp" style="width:{enemyHpPct}%"></div></div>
          <div class="dot enemy-dot" bind:this={enemyDot}></div>
          <div class="fighter-name">{ui.battle.enemyName}</div>
          <div class="hp-num">{ui.hpView.enemy} / {ui.battle.enemyMaxHp}</div>
        {:else}
          <div class="dot enemy-dot empty"></div>
          <div class="fighter-name">？？？</div>
        {/if}
      </div>
    </div>

    <div class="controls">
      {#if ui.phase === 'idle'}
        <button class="primary" onclick={enterDungeon}>
          進入副本（第 {startingFloor(character.highestFloor)} 層開始）
        </button>
      {:else if ui.phase === 'battle'}
        <span class="fighting">戰鬥中…</span>
        <span class="speed">
          倍速
          {#each [1, 2, 4] as s (s)}
            <button class:active={ui.speed === s} onclick={() => (ui.speed = s)}>×{s}</button>
          {/each}
        </span>
      {:else if ui.phase === 'decision' && ui.run}
        <button class="primary" onclick={continueRun}>深入第 {ui.run.floor + 1} 層</button>
        <button onclick={retreat}>撤退</button>
      {/if}
    </div>
  {/if}
</div>
