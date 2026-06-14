<script lang="ts">
  import { pushLog, ui } from './store.svelte.js';
  import { playBattle } from './playback.js';
  import { continueRun, enterDungeon, finishBattle, newLife, retreat } from './actions.js';
  import { startingFloor } from '../core/dungeon.js';
  import type { BattleEvent, Side } from '../core/combat.js';

  let playerDot: HTMLDivElement | undefined = $state();
  let enemyDot: HTMLDivElement | undefined = $state();
  let nameInput = $state('');

  // 詠唱魔法陣與冰凍狀態（依事件時間軸顯示）
  let casting = $state<{ player: boolean; enemy: boolean }>({ player: false, enemy: false });
  let frozen = $state<{ player: boolean; enemy: boolean }>({ player: false, enemy: false });
  const timers: { cast: Record<Side, ReturnType<typeof setTimeout> | undefined>; frozen: Record<Side, ReturnType<typeof setTimeout> | undefined> } = {
    cast: { player: undefined, enemy: undefined },
    frozen: { player: undefined, enemy: undefined },
  };

  const character = $derived(ui.game.character);
  const playerHpPct = $derived(
    ui.battle ? Math.max(0, (ui.hpView.player / ui.battle.playerMaxHp) * 100) : 100,
  );
  const enemyHpPct = $derived(
    ui.battle ? Math.max(0, (ui.hpView.enemy / ui.battle.enemyMaxHp) * 100) : 100,
  );

  function dotOf(side: Side): HTMLDivElement | undefined {
    return side === 'player' ? playerDot : enemyDot;
  }

  function flash(el: HTMLDivElement | undefined, cls: string): void {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 強制 reflow，讓同名動畫能重新觸發
    el.classList.add(cls);
  }

  function startTimed(
    kind: 'cast' | 'frozen',
    side: Side,
    durationSec: number,
  ): void {
    const state = kind === 'cast' ? casting : frozen;
    state[side] = true;
    clearTimeout(timers[kind][side]);
    timers[kind][side] = setTimeout(() => {
      state[side] = false;
    }, (durationSec * 1000) / ui.speed);
  }

  function stopTimed(kind: 'cast' | 'frozen', side: Side): void {
    const state = kind === 'cast' ? casting : frozen;
    state[side] = false;
    clearTimeout(timers[kind][side]);
  }

  function handleEvent(ev: BattleEvent): void {
    pushLog(ev.text, ev.kind, ev.t, ev.flavor);
    if (ev.side === 'none') return;
    const side = ev.side;
    const target = dotOf(side);
    const other = dotOf(side === 'player' ? 'enemy' : 'player');

    switch (ev.kind) {
      case 'cast':
        startTimed('cast', side, ev.duration ?? 1);
        break;
      case 'hurt':
        stopTimed('cast', side === 'player' ? 'enemy' : 'player'); // 出手者的詠唱結束了
        flash(other, ev.flavor === '暴擊' || ev.flavor === '碾壓' ? 'anim-attack-heavy' : 'anim-attack');
        flash(target, ev.flavor === '暴擊' || ev.flavor === '碾壓' ? 'anim-hit-heavy' : 'anim-hit');
        break;
      case 'miss':
        stopTimed('cast', side === 'player' ? 'enemy' : 'player');
        flash(other, 'anim-attack');
        flash(target, 'anim-dodge');
        break;
      case 'dot':
        flash(target, 'anim-dot');
        break;
      case 'heal':
        stopTimed('cast', side);
        flash(target, 'anim-heal');
        break;
      case 'status':
        if (ev.text.includes('中【冰凍】') || ev.text.includes('中【暈眩】')) {
          startTimed('frozen', side, ev.duration ?? 1);
        }
        if (ev.text.includes('被打破')) stopTimed('frozen', side);
        if (ev.text.includes('詠唱中斷')) stopTimed('cast', side);
        break;
      case 'death':
        stopTimed('cast', side);
        stopTimed('frozen', side);
        target?.classList.add('dead');
        break;
      default:
        break;
    }
    if (ev.hpAfter !== undefined) ui.hpView[side] = ev.hpAfter;
  }

  $effect(() => {
    const battle = ui.battle;
    if (!battle || ui.phase !== 'battle') return;
    playerDot?.classList.remove('dead');
    enemyDot?.classList.remove('dead');
    stopTimed('cast', 'player');
    stopTimed('cast', 'enemy');
    stopTimed('frozen', 'player');
    stopTimed('frozen', 'enemy');
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
      <button class="primary" onclick={() => newLife(nameInput)}>踏入世界</button>
    </div>
  {:else}
    <div class="arena">
      <div class="fighter">
        <div class="hp-bar"><div class="hp-fill player-hp" style="width:{playerHpPct}%"></div></div>
        <div class="dot-wrap" class:is-frozen={frozen.player}>
          {#if casting.player}<div class="magic-circle"></div>{/if}
          <div class="dot player-dot" bind:this={playerDot}></div>
          {#if frozen.player}<div class="ice-overlay">❄</div>{/if}
        </div>
        <div class="fighter-name">{character.name}</div>
        {#if ui.battle}
          <div class="hp-num">{ui.hpView.player} / {ui.battle.playerMaxHp}</div>
        {/if}
      </div>

      <div class="vs">
        {#if ui.run}
          <span class="floor-label">第 {ui.run.floor} 層</span>
        {:else}
          <span class="floor-label idle">世界</span>
        {/if}
      </div>

      <div class="fighter">
        {#if ui.battle}
          <div class="hp-bar"><div class="hp-fill enemy-hp" style="width:{enemyHpPct}%"></div></div>
          <div class="dot-wrap" class:is-frozen={frozen.enemy}>
            {#if casting.enemy}<div class="magic-circle"></div>{/if}
            <div class="dot enemy-dot" bind:this={enemyDot}></div>
            {#if frozen.enemy}<div class="ice-overlay">❄</div>{/if}
          </div>
          <div class="fighter-name">{ui.battle.enemyName}</div>
          <div class="hp-num">{ui.hpView.enemy} / {ui.battle.enemyMaxHp}</div>
        {:else}
          <div class="dot-wrap"><div class="dot enemy-dot empty"></div></div>
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
