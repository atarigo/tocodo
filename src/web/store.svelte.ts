import { newGame, SAVE_VERSION, type GameState } from '../state/model.js';
import type { BattleResult, EventKind, HurtFlavor } from '../core/combat.js';

export type Phase = 'idle' | 'battle' | 'decision' | 'dead';

export interface LogLine {
  id: number;
  text: string;
  kind: EventKind | 'reward' | 'shop' | 'divider';
  /** 戰鬥內時間戳（秒），系統訊息沒有 */
  t?: number;
  flavor?: HurtFlavor;
}

export interface RunState {
  floor: number;
  hp: number;
  mp: number;
  floorsCleared: number;
}

export interface BattleView {
  result: BattleResult;
  enemyName: string;
  enemyMaxHp: number;
  playerMaxHp: number;
}

const SAVE_KEY = 'bloody-city-save';
const MAX_LOG_LINES = 800;

function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      // 不相容的舊存檔直接重開世界
      if (parsed.version === SAVE_VERSION) return parsed;
    }
  } catch {
    // 壞掉的存檔直接重開世界
  }
  return newGame();
}

export const ui = $state({
  game: loadGame(),
  phase: 'idle' as Phase,
  run: null as RunState | null,
  battle: null as BattleView | null,
  /** 戰鬥回放倍速 */
  speed: 2,
  log: [] as LogLine[],
  /** 回放中的血條（跟著事件時間軸走，而不是直接跳到結果） */
  hpView: { player: 0, enemy: 0 },
});

let logId = 0;

export function pushLog(text: string, kind: LogLine['kind'] = 'system', t?: number, flavor?: HurtFlavor): void {
  ui.log.push({ id: logId++, text, kind, t, flavor });
  if (ui.log.length > MAX_LOG_LINES) ui.log.splice(0, ui.log.length - MAX_LOG_LINES);
}

export function saveGame(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(ui.game));
}

export function resetWorld(): void {
  localStorage.removeItem(SAVE_KEY);
  ui.game = newGame();
  ui.phase = 'idle';
  ui.run = null;
  ui.battle = null;
  ui.log.length = 0;
  pushLog('世界已重置');
}
