import type { BattleEvent, BattleResult } from '../core/combat.js';

export interface PlaybackHooks {
  onEvent: (ev: BattleEvent) => void;
  onDone: () => void;
  getSpeed: () => number;
}

/**
 * 戰鬥回放：把模擬結果的事件流照時間軸吐出來。
 * 純命令式 JS，不依賴框架——之後換 PixiJS 畫面也是接這裡。
 */
export function playBattle(result: BattleResult, hooks: PlaybackHooks): () => void {
  let playhead = 0;
  let index = 0;
  let last = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();
    playhead += ((now - last) / 1000) * hooks.getSpeed();
    last = now;

    while (index < result.events.length && result.events[index].t <= playhead) {
      hooks.onEvent(result.events[index]);
      index += 1;
    }
    if (index >= result.events.length) {
      clearInterval(timer);
      hooks.onDone();
    }
  }, 50);

  return () => clearInterval(timer);
}
