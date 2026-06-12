import type { Attributes } from './types.js';
import type { Rng } from './rng.js';

/**
 * 單骰攻擊表（WoW 式）：每次攻擊先依攻守雙方數值「組表」，再擲一顆骰決定結果。
 * 雙邊數值的比較全部發生在組表時，擲骰本身不看任何屬性。
 *
 * Bar 依固定優先序填入，空間不夠時從尾端開始擠掉：
 * [落空][閃避][躲避][招架][格檔] [暴擊][要害][碾壓] [普通命中=剩餘]
 * 防禦段堆得夠寬 → 普通命中先歸零 → 碾壓、要害、暴擊依序被擠出表外。
 *
 * 這個模組目前只給實驗室（playground）使用，現行戰鬥引擎尚未接上；
 * 一段一段加、邊看邊討論，定案後才整合進引擎。
 *
 * 原則：所有段都由屬性或裝備提供，沒有任何預設數值；屬性最低為 0。
 * 全部歸零時 = 100% 普通命中。
 *
 * 進度：
 *   第 0 步（完成）：空表——100% 普通命中
 *   第 1 步（現在）：躲避（守方幸運，飽和曲線，已定案）；
 *                   閃避（守方敏捷 vs 攻方靈巧）天花板待拍板
 *   第 2 步：招架（無盾也有）、格檔（有盾才有，減傷較高）
 *   第 3 步：暴擊、要害
 *   第 4 步：碾壓（來源待定義）
 */
export type AttackOutcome =
  | '落空'
  | '閃避'
  | '躲避'
  | '招架'
  | '格檔'
  | '暴擊'
  | '要害'
  | '碾壓'
  | '命中';

export interface TableSegment {
  outcome: AttackOutcome;
  /** 0〜1 */
  width: number;
}

export interface AttackTableContext {
  attacker: Attributes;
  defender: Attributes;
  /** 有盾才有格檔段（第 3 步起使用） */
  defenderHasShield: boolean;
}

// ─ 躲避（已定案 2026-06-12）─
// 躲避 ＝ 上限 × 幸運 ÷ (幸運 ＋ K)：飽和曲線，前段便宜、後段昂貴。
// 幸運 128 → 6%、255 → 8%。不可被任何機制壓縮——命中永遠堆不滿的原因，
// 因此它必須是防禦段裡最小的一塊。
const EVADE_CAP = 0.12;
const EVADE_K = 128;

export function evadeWidth(luk: number): number {
  return (EVADE_CAP * luk) / (luk + EVADE_K);
}

export function buildAttackTable(ctx: AttackTableContext): TableSegment[] {
  // 依優先序填入；空間不夠時後面的段被擠掉，普通命中拿剩餘空間
  const queued: TableSegment[] = [
    // 閃避段（敏捷 vs 靈巧）：天花板尚未拍板，定案後加入
    {
      outcome: '躲避',
      width: evadeWidth(ctx.defender.luk),
    },
  ];

  const table: TableSegment[] = [];
  let remaining = 1;
  for (const segment of queued) {
    const width = Math.min(segment.width, remaining);
    if (width > 0) table.push({ outcome: segment.outcome, width });
    remaining -= width;
  }
  if (remaining > 0) table.push({ outcome: '命中', width: remaining });
  return table;
}

export function rollOutcome(table: TableSegment[], rng: Rng): AttackOutcome {
  let roll = rng();
  for (const segment of table) {
    roll -= segment.width;
    if (roll < 0) return segment.outcome;
  }
  return table[table.length - 1]?.outcome ?? '命中';
}
