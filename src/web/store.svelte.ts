import { newGame, type GameState } from '../state/model.js';
import type { BattleResult, EventKind } from '../core/combat.js';

export type Phase = 'idle' | 'battle' | 'decision' | 'dead';

export interface LogLine {
  id: number;
  text: string;
  kind: EventKind | 'reward' | 'shop';
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
    if (raw) return JSON.parse(raw) as GameState;
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

export function pushLog(text: string, kind: LogLine['kind'] = 'system'): void {
  ui.log.push({ id: logId++, text, kind });
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
  pushLog('世界已重置。');
}
