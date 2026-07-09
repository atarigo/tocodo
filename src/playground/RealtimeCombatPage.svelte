<script lang="ts">
  import { attrRank, attrUpgradeCost } from '../core/economy.js';
  import { navigate } from '../web/router.svelte.js';
  import type {
    ActionBarState,
    ActionLoadout,
    Attributes,
    BattleResult,
    BattleSetup,
    CombatEvent,
    CombatHandSide,
    CombatStageSnapshot,
    Rank,
    EquipmentLoadout,
    SkillFailureReason,
    StatusEffect,
  } from '../core/types.js';
  import AttributePanel from './AttributePanel.svelte';
  import RealtimeMapStage, { type MapNearbyState } from './RealtimeMapStage.svelte';
  import RealtimeCombatStage from './RealtimeCombatStage.svelte';
  import { DEFAULT_ACTION_LOADOUT } from '../core/battleSetup.js';
  import { DEFAULT_LOADOUT, normalizeLoadout } from '../data/equipmentCatalog.js';
  import {
    createDungeonStageSetup,
    emptyRunStats,
    killRewardFor,
    NOVICE_DIFFICULTIES,
    NOVICE_DUNGEON,
    stageRequiredKills,
    type DungeonRunStats,
    type GameScene,
    type NoviceDifficulty,
    type NoviceRewardChoice,
  } from './gameFlow.js';
  // items removed — not in spec
  import { skillById } from '../data/skillCatalog.js';

  let events = $state<CombatEvent[]>([]);
  let playerAttrs = $state<Attributes>({ str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 });
  let enemyDifficulty = $state<Rank>('D');
  let playerLoadout = $state<EquipmentLoadout>({ ...DEFAULT_LOADOUT });
  let actionLoadout = $state<ActionLoadout>({
    skillSlots: [...DEFAULT_ACTION_LOADOUT.skillSlots],
  });
  let battleSetup = $state<BattleSetup | null>(null);
  let playerStatuses = $state<StatusEffect[]>([]);
  let playerActionState = $state<ActionBarState>({
    skillCooldowns: [0, 0, 0, 0, 0],
    skillFailureReasons: [null, null, null, null, null],
  });
  let scene = $state<GameScene>('landing');
  let selectedDifficulty = $state<NoviceDifficulty>(1);
  let currentStageIndex = $state(0);
  let currentStageKills = $state(0);
  let currentStageElapsed = $state(0);
  let sessionId = $state(0);
  let battleResult = $state<BattleResult | null>(null);
  let runStats = $state<DungeonRunStats>(emptyRunStats());
  let rewardPoints = $state(0);
  let pendingRewardPoints = $state(0);
  let dungeonSource = $state<'novice' | 'city'>('novice');
  let stageResolved = $state(false);
  let isTransitioning = $state(false);
  let transitionText = $state('');
  let nearby = $state<MapNearbyState>({
    novicePortal: false,
    noviceNpc: false,
    rewardAltar: false,
    rewardPlatform: false,
    cityShop: false,
    cityPortal: false,
  });

  const currentStage = $derived(NOVICE_DUNGEON.stages[currentStageIndex] ?? null);
  const currentStageRequiredKills = $derived(currentStage ? stageRequiredKills(currentStage, selectedDifficulty) : 0);
  const stageLabel = $derived(currentStage ? `${currentStageIndex + 1} / ${NOVICE_DUNGEON.stages.length}` : '0 / 0');
  const selectedDifficultyLabel = $derived(NOVICE_DIFFICULTIES.find((item) => item.id === selectedDifficulty)?.label ?? '');

  function resetCombatState(): void {
    events = [];
    playerStatuses = [];
    playerActionState = {
      skillCooldowns: [0, 0, 0, 0, 0],
      skillFailureReasons: [null, null, null, null, null],
    };
    currentStageKills = 0;
    currentStageElapsed = 0;
    battleResult = null;
    stageResolved = false;
  }

  function setScene(nextScene: GameScene, label: string): void {
    transitionText = label;
    isTransitioning = true;
    window.setTimeout(() => {
      scene = nextScene;
      isTransitioning = false;
    }, 360);
  }

  function startGame(): void {
    setScene('novicePlaza', '進入新手廣場');
  }

  function resetGameToStart(): void {
    resetCombatState();
    battleSetup = null;
    selectedDifficulty = 1;
    currentStageIndex = 0;
    runStats = emptyRunStats();
    pendingRewardPoints = 0;
    rewardPoints = 0;
    setScene('landing', '回到起點');
  }

  function chooseDifficulty(difficulty: NoviceDifficulty): void {
    selectedDifficulty = difficulty;
    setScene('noviceReward', '開啟新手獎勵');
  }

  function chooseNoviceReward(choice: NoviceRewardChoice): void {
    if (choice === 'weapon') {
      playerLoadout = { ...playerLoadout, mainHand: 'hunting-bow', offHand: null };
    } else if (choice === 'armor') {
      playerLoadout = {
        ...playerLoadout,
        head: 'leather-cap',
        body: 'leather-armor',
        legs: 'leather-pants',
        feet: 'leather-boots',
      };
    } else {
      rewardPoints += 500;
    }
    startDungeon('novice', selectedDifficulty);
  }

  function startDungeon(source: 'novice' | 'city', difficulty: NoviceDifficulty): void {
    dungeonSource = source;
    selectedDifficulty = difficulty;
    currentStageIndex = 0;
    runStats = emptyRunStats();
    pendingRewardPoints = 0;
    setScene('dungeon', `進入 ${NOVICE_DUNGEON.name}`);
    window.setTimeout(() => startStage(0), 380);
  }

  function startStage(index: number): void {
    const stage = NOVICE_DUNGEON.stages[index];
    if (!stage) return;
    resetCombatState();
    battleSetup = createDungeonStageSetup({
      playerAttrs,
      loadout: playerLoadout,
      actionLoadout,
      difficulty: selectedDifficulty,
      stage,
    });
    sessionId += 1;
  }

  function addEvent(event: CombatEvent): void {
    events.unshift(event);
    if (events.length > 120) events.length = 120;

    if (event.kind === 'death' && event.target.side === 'enemy') {
      currentStageKills += 1;
      const enemyId = enemyIdForActor(event.target.id);
      if (enemyId) {
        runStats.kills[enemyId] = (runStats.kills[enemyId] ?? 0) + 1;
        const reward = killRewardFor(enemyId, selectedDifficulty);
        runStats.killRewardPoints += reward;
        pendingRewardPoints += reward;
        runStats = { kills: { ...runStats.kills }, killRewardPoints: runStats.killRewardPoints };
      }
      if (currentStage?.kind === 'killCount' && currentStageKills >= currentStageRequiredKills) {
        completeStage();
      }
    }

    if (event.kind === 'battleEnd') {
      if (stageResolved && event.result === 'playerWon') return;
      battleResult = event.result;
      if (event.result === 'playerLost') scene = 'dungeon';
      if (event.result === 'playerWon') completeStage();
    }
  }

  function updateStageSnapshot(snapshot: CombatStageSnapshot): void {
    currentStageElapsed = snapshot.elapsed;
    if (currentStage?.kind === 'survive' && snapshot.elapsed >= (currentStage.surviveSeconds ?? 0)) {
      completeStage();
    }
  }

  function completeStage(): void {
    if (scene !== 'dungeon' || stageResolved) return;
    stageResolved = true;
    const nextIndex = currentStageIndex + 1;
    if (nextIndex >= NOVICE_DUNGEON.stages.length) {
      battleSetup = null;
      battleResult = null;
      setScene('rewardPlatform', '前往獎勵平台');
      return;
    }
    currentStageIndex = nextIndex;
    setScene('dungeon', NOVICE_DUNGEON.stages[nextIndex].title);
    window.setTimeout(() => startStage(nextIndex), 380);
  }

  function claimRewardAndEnterCity(): void {
    rewardPoints += pendingRewardPoints;
    pendingRewardPoints = 0;
    setScene('city', '前往城市');
  }

  function upgradeAttr(key: keyof Attributes): void {
    const current = playerAttrs[key];
    const cost = attrUpgradeCost(current);
    if (rewardPoints < cost || current >= 255) return;
    rewardPoints -= cost;
    playerAttrs = { ...playerAttrs, [key]: current + 1 };
  }

  function enemyIdForActor(actorId: number): string | null {
    const enemyIndex = actorId - 2;
    return battleSetup?.enemies[enemyIndex]?.enemyId ?? null;
  }

  function outcomeNote(outcome: string): string {
    return outcome === '命中' ? '' : ` [${outcome}]`;
  }

  function attackHandNote(hand: CombatHandSide | undefined): string {
    if (hand === 'main') return ' [主手]';
    if (hand === 'off') return ' [副手]';
    return '';
  }

  function statusActionText(action: 'apply' | 'expire' | 'resist'): string {
    if (action === 'apply') return '受到';
    if (action === 'expire') return '結束';
    return '抵抗';
  }

  function skillFailureText(reason: SkillFailureReason): string {
    if (reason === 'cooldown') return '冷卻中';
    if (reason === 'notEnoughMp') return 'MP不足';
    if (reason === 'noTarget') return '沒有有效目標';
    if (reason === 'tooClose') return '距離太近';
    if (reason === 'tooFar') return '距離太遠';
    if (reason === 'notInMeleeRange') return '不在近戰範圍';
    return '被障礙物阻擋';
  }

  function eventText(event: CombatEvent): string {
    switch (event.kind) {
      case 'damage':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 造成 ${event.target.name} ${event.amount} 點傷害${attackHandNote(event.hand)}${outcomeNote(event.outcome)}`;
      case 'miss':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'}，${event.target.name} ${event.outcome}${attackHandNote(event.hand)}`;
      case 'status':
        return `${event.target.name} ${statusActionText(event.statusAction)} ${event.statusName}`;
      case 'resource':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 恢復 ${event.target.name} ${event.amount} 點 ${event.resource.toUpperCase()}`;
      case 'actionFail':
        return `${event.source.name} 使用 ${event.action?.name ?? '動作'} 失敗 [${skillFailureText(event.reason)}]`;
      case 'death':
        return `${event.target.name} 倒下`;
      case 'battleEnd':
        return event.result === 'playerWon' ? '戰鬥結束：玩家勝利' : '戰鬥結束：玩家失敗';
      default:
        return '';
    }
  }

  function skillCooldown(slotIndex: number): number {
    return playerActionState.skillCooldowns[slotIndex] ?? 0;
  }

  function skillFailureReason(slotIndex: number): SkillFailureReason | null {
    return playerActionState.skillFailureReasons[slotIndex] ?? null;
  }

</script>

<header class="topbar">
  <h1><a class="topbar-home" href="/" onclick={(e) => { e.preventDefault(); navigate('/'); }}>世界</a></h1>
  <span class="era">即時戰鬥</span>
</header>

<main class="realtime-layout">
  <aside class="realtime-left">
    <AttributePanel bind:playerAttrs bind:enemyDifficulty bind:playerLoadout bind:actionLoadout {battleSetup} />
  </aside>

  <section class="realtime-center">
    {#if isTransitioning}
      <div class="transition-screen">
        <div>{transitionText}</div>
      </div>
    {/if}

    {#if scene === 'landing'}
      <div class="landing-scene">
        <div class="landing-copy">
          <p class="scene-kicker">即時戰鬥</p>
          <h2>世界</h2>
          <p>從新手廣場開始，通過傳送門進入第一個 D 級試煉。</p>
          <button class="primary" onclick={startGame}>開始遊戲</button>
        </div>
      </div>
    {:else if scene === 'novicePlaza'}
      <RealtimeMapStage {scene} {playerLoadout} onNearbyChange={(state) => (nearby = state)} />
    {:else if scene === 'noviceReward'}
      <RealtimeMapStage {scene} {playerLoadout} onNearbyChange={(state) => (nearby = state)} />
    {:else if scene === 'dungeon' && battleSetup && currentStage}
      {#key sessionId}
        <RealtimeCombatStage
          onEvent={addEvent}
                   onPlayerActionState={(state) => (playerActionState = state)}
          onPlayerStatuses={(statuses) => (playerStatuses = statuses)}
          onSnapshot={updateStageSnapshot}
          setup={battleSetup}
          {sessionId}
        />
      {/key}
      {#if battleResult === 'playerLost'}
        <div class="result-panel">
          <div class="result-title">死亡</div>
          <p>本輪流程結束，回到開始遊戲。</p>
          <button class="primary" onclick={resetGameToStart}>回到開始</button>
        </div>
      {/if}
    {:else if scene === 'dungeon'}
      <div class="transition-screen inline">
        <div>準備戰鬥</div>
      </div>
    {:else if scene === 'rewardPlatform'}
      <RealtimeMapStage {scene} {playerLoadout} onNearbyChange={(state) => (nearby = state)} />
    {:else if scene === 'city'}
      <RealtimeMapStage {scene} {playerLoadout} onNearbyChange={(state) => (nearby = state)} />
    {/if}

    {#if scene === 'novicePlaza' || scene === 'noviceReward' || scene === 'rewardPlatform' || scene === 'city'}
      <div class="arena-overlay">
        <div class="arena-frame">
          {#if scene === 'novicePlaza' && nearby.noviceNpc}
            <div class="field-panel npc-dialog">
              <h3>說明 NPC</h3>
              <p>...</p>
            </div>
          {/if}
          {#if scene === 'novicePlaza' && nearby.novicePortal}
            <div class="field-panel portal-choice-panel">
              <h3>新手副本限定</h3>
              <p>選擇進入難度。</p>
              <div class="choice-list">
                {#each NOVICE_DIFFICULTIES as difficulty}
                  <button onclick={() => chooseDifficulty(difficulty.id)}>{difficulty.label}</button>
                {/each}
              </div>
            </div>
          {/if}
          {#if scene === 'noviceReward' && nearby.rewardAltar}
            <div class="field-panel reward-choice-panel">
              <h3>新手獎勵三選一</h3>
              <p>你選擇的 {selectedDifficultyLabel}，獲得新手獎勵三選一：</p>
              <div class="choice-grid">
                <button onclick={() => chooseNoviceReward('weapon')}>
                  <strong>D 級武器</strong>
                  <span>取得獵弓，進入副本。</span>
                </button>
                <button onclick={() => chooseNoviceReward('armor')}>
                  <strong>D 級防具</strong>
                  <span>取得皮帽、皮甲、皮褲、皮靴。</span>
                </button>
                <button onclick={() => chooseNoviceReward('points')}>
                  <strong>獎勵點 500</strong>
                  <span>立即取得 500 點。</span>
                </button>
              </div>
            </div>
          {/if}
          {#if scene === 'rewardPlatform' && nearby.rewardPlatform}
            <div class="field-panel reward-choice-panel">
              <h3>副本結算</h3>
              <div class="summary-list big">
                <div><span>殺敵數</span><strong>{Object.values(runStats.kills).reduce((sum, count) => sum + count, 0)}</strong></div>
                <div><span>殺敵獎勵點總和</span><strong>{pendingRewardPoints}</strong></div>
              </div>
              <div class="kill-list">
                {#each Object.entries(runStats.kills) as [enemyId, count]}
                  <div><span>{enemyId}</span><strong>{count}</strong></div>
                {/each}
              </div>
              <button class="primary" onclick={claimRewardAndEnterCity}>領取獎勵並前往城市</button>
            </div>
          {/if}
          {#if scene === 'city' && nearby.cityPortal}
            <div class="field-panel portal-choice-panel">
              <h3>傳送門</h3>
              <p>進入 {NOVICE_DUNGEON.name}，固定 100% 難度。</p>
              <button class="primary" onclick={() => startDungeon('city', 1)}>進入副本</button>
            </div>
          {/if}
          {#if scene === 'city' && nearby.cityShop}
            <section class="field-panel shop-panel">
              <h3>屬性商店</h3>
              <div class="points">獎勵點：<strong>{rewardPoints}</strong></div>
              {#each Object.entries(playerAttrs) as [key, value]}
                <div class="upgrade-row">
                  <span>{key.toUpperCase()} {value} / {attrRank(value)}</span>
                  <button disabled={rewardPoints < attrUpgradeCost(value) || value >= 255} onclick={() => upgradeAttr(key as keyof Attributes)}>
                    升級 {attrUpgradeCost(value)}
                  </button>
                </div>
              {/each}
            </section>
          {/if}
        </div>
      </div>
    {/if}

    {#if scene !== 'landing'}
      <div class="stage-actions">
        <div class="status-badges">
          {#if scene === 'dungeon' && currentStage}
            <div class="stage-chip">
              <span>{stageLabel}</span>
              <strong>{currentStage.title}</strong>
            </div>
            {#if currentStage.kind === 'survive'}
              <div class="stage-chip">
                <span>存活</span>
                <strong>{Math.min(currentStageElapsed, currentStage.surviveSeconds ?? 0).toFixed(1)} / {currentStage.surviveSeconds}s</strong>
              </div>
            {:else}
              <div class="stage-chip">
                <span>擊殺</span>
                <strong>{currentStageKills} / {currentStageRequiredKills}</strong>
              </div>
            {/if}
          {/if}
          {#each playerStatuses as status (status.id)}
            <div class="status-badge" class:buff-badge={status.kind === 'buff'}>
              <span>{status.name}</span>
              <strong>{Math.max(0, status.remaining).toFixed(1)}s</strong>
            </div>
          {/each}
        </div>
        <button onclick={resetGameToStart}>重新開始</button>
      </div>

      <div class="quickbar">
        <div class="quickbar-row skills">
          {#each Array(5) as _, index}
            <div
              class="quick-slot"
              class:cooling={skillCooldown(index) > 0}
              class:insufficient={skillFailureReason(index) === 'notEnoughMp' && skillCooldown(index) <= 0}
            >
              {#if actionLoadout.skillSlots[index]}
                <strong>{skillById(actionLoadout.skillSlots[index]).name}</strong>
                {#if skillCooldown(index) > 0}
                  <em>{skillCooldown(index).toFixed(1)}</em>
                {/if}
              {/if}
              <span>{index + 1}</span>
            </div>
          {/each}
        </div>
        <!-- items removed — not in spec -->
      </div>
    {/if}
  </section>

  <aside class="realtime-log">
    <h2>戰鬥日誌</h2>
    <div class="log-list">
      {#each events as event (event.id)}
        <div
          class:player-line={event.source.side === 'player'}
          class:enemy-line={event.source.side === 'enemy'}
          class:ally-line={event.source.side === 'ally'}
          class:neutral-line={event.source.side === 'neutral'}
        >
          {eventText(event)}
        </div>
      {/each}
    </div>
  </aside>
</main>

<style>
  .realtime-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 320px minmax(420px, 1fr) 360px;
    gap: 10px;
    min-height: 0;
    padding: 10px;
  }

  .realtime-left,
  .realtime-center,
  .realtime-log {
    min-height: 0;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: var(--panel);
  }

  .realtime-left {
    overflow-y: auto;
    padding: 0;
  }

  .realtime-center {
    position: relative;
    overflow: hidden;
    padding: 12px;
  }

  .transition-screen {
    position: absolute;
    inset: 12px;
    z-index: 10;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 6px;
    color: #f4f6fb;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0;
    background: rgba(8, 10, 14, 0.82);
    animation: scene-fade 0.38s ease both;
  }

  .transition-screen.inline {
    z-index: 1;
    background: rgba(14, 16, 22, 0.94);
  }

  .landing-scene {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 520px;
    color: var(--text);
    overflow: hidden;
    border-radius: 6px;
    background: #11131a;
    touch-action: none;
    animation: scene-enter 0.24s ease both;
    display: grid;
    align-items: center;
    padding: 42px;
    background:
      linear-gradient(90deg, rgba(14, 17, 22, 0.86), rgba(14, 17, 22, 0.34)),
      linear-gradient(140deg, rgba(42, 49, 59, 0.58), rgba(17, 19, 25, 0.94));
  }

  .landing-copy {
    display: grid;
    gap: 14px;
    max-width: 460px;
  }

  .landing-copy h2 {
    margin: 0;
    font-size: 42px;
  }

  .landing-copy p {
    margin: 0;
    color: var(--muted);
    line-height: 1.7;
  }

  .landing-copy .primary {
    width: fit-content;
  }

  .arena-overlay {
    position: absolute;
    inset: 12px;
    z-index: 3;
    pointer-events: none;
    container-type: size;
  }

  .arena-frame {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(100cqw, 133.333cqh);
    height: min(75cqw, 100cqh);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .field-panel {
    position: absolute;
    display: grid;
    gap: 10px;
    max-width: calc(100% - 56px);
    max-height: calc(100% - 170px);
    overflow: auto;
    pointer-events: auto;
    padding: 16px;
    border-radius: 8px;
    background: rgba(15, 18, 25, 0.9);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
  }

  .portal-choice-panel {
    right: 28px;
    top: 64px;
    width: min(320px, calc(100% - 60px));
    border: 1px solid rgba(117, 154, 240, 0.42);
  }

  .npc-dialog {
    left: 28px;
    bottom: 126px;
    width: min(280px, calc(100% - 56px));
    border: 1px solid rgba(220, 198, 132, 0.42);
  }

  .reward-choice-panel {
    left: 50%;
    bottom: 126px;
    width: min(620px, calc(100% - 56px));
    border: 1px solid rgba(220, 198, 132, 0.42);
    transform: translateX(-50%);
  }

  .field-panel.shop-panel {
    left: 28px;
    top: 64px;
    width: min(360px, calc(100% - 56px));
    border-color: rgba(112, 202, 139, 0.42);
  }

  .field-panel h3,
  .field-panel p {
    margin: 0;
  }

  .field-panel p {
    color: var(--muted);
    line-height: 1.5;
  }

  @keyframes scene-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scene-enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .scene-kicker {
    margin: 0 0 8px;
    color: var(--accent-2);
    font-size: 13px;
  }

  .shop-panel {
    display: grid;
    gap: 12px;
    padding: 18px;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: rgba(16, 18, 24, 0.72);
  }

  .choice-list,
  .choice-grid {
    display: grid;
    gap: 10px;
  }

  .choice-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .choice-grid button {
    display: grid;
    gap: 8px;
    min-height: 120px;
    text-align: left;
  }

  .choice-grid span,
  .points {
    color: var(--muted);
  }

  .stage-actions {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    pointer-events: none;
  }

  .stage-actions button {
    background: rgba(42, 45, 57, 0.88);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .status-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
    pointer-events: none;
  }

  .status-badge,
  .stage-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 76px;
    height: 28px;
    padding: 0 9px;
    border: 1px solid rgba(255, 95, 90, 0.85);
    border-radius: 4px;
    background: rgba(37, 19, 22, 0.9);
    color: #ffd6d3;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    backdrop-filter: blur(4px);
  }

  .stage-chip {
    border-color: rgba(91, 141, 239, 0.55);
    background: rgba(15, 25, 45, 0.9);
    color: #dce7ff;
  }

  .status-badge.buff-badge {
    border-color: rgba(94, 211, 132, 0.82);
    background: rgba(20, 58, 35, 0.9);
    color: #d7ffe0;
  }

  .status-badge strong,
  .stage-chip strong {
    margin-left: auto;
    font-weight: 600;
  }

  .quickbar {
    position: absolute;
    left: 50%;
    bottom: 22px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .quickbar-row {
    display: flex;
    gap: 6px;
  }

  .quick-slot {
    position: relative;
    width: 42px;
    height: 42px;
    border: 1px solid rgba(216, 218, 227, 0.28);
    border-radius: 4px;
    background: rgba(20, 22, 29, 0.82);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(4px);
  }

  .quick-slot.cooling {
    border-color: rgba(142, 147, 160, 0.42);
    background: rgba(48, 51, 59, 0.86);
    filter: grayscale(0.9);
  }

  .quick-slot.insufficient {
    border-color: rgba(91, 141, 239, 0.28);
    background: rgba(18, 27, 48, 0.86);
    color: #9fb7ef;
  }

  .quick-slot.used {
    border-color: rgba(216, 218, 227, 0.16);
    background: rgba(13, 15, 20, 0.7);
  }

  .quick-slot span {
    position: absolute;
    right: 5px;
    bottom: 3px;
    color: var(--muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .quick-slot strong {
    position: absolute;
    inset: 6px 5px 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--text);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
  }

  .quick-slot em {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f0f1f4;
    font-size: 13px;
    font-style: normal;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    background: rgba(24, 25, 30, 0.48);
  }

  .item-slot {
    width: 40px;
    height: 40px;
    border-color: rgba(199, 185, 139, 0.38);
  }

  .result-panel {
    position: absolute;
    inset: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(17, 19, 26, 0.72);
    backdrop-filter: blur(3px);
    border-radius: 6px;
    color: var(--text);
  }

  .result-title {
    color: var(--text);
    font-size: 32px;
    font-weight: 700;
  }

  .summary-list,
  .kill-list {
    display: grid;
    gap: 8px;
    max-width: 420px;
  }

  .summary-list.big {
    font-size: 18px;
  }

  .summary-list div,
  .kill-list div,
  .upgrade-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .upgrade-row {
    padding: 6px 0;
  }

  .realtime-log {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 12px;
  }

  .realtime-log h2 {
    flex: 0 0 auto;
    margin: 0 0 10px;
    color: var(--accent-2);
    font-size: 14px;
  }

  .log-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    line-height: 1.45;
  }

  .player-line,
  .ally-line {
    color: var(--good);
  }

  .enemy-line {
    color: var(--accent);
  }

  .neutral-line {
    color: #c7b98b;
  }

  @media (max-width: 980px) {
    .realtime-layout {
      grid-template-columns: 1fr;
    }

    .realtime-left,
    .realtime-log {
      display: none;
    }
  }
</style>
