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
 * 進度：
 *   第 0 步（現在）：空表——100% 普通命中
 *   第 1 步：落空（攻方命中 vs 基礎落空）
 *   第 2 步：閃避（敏捷）、躲避（幸運）
 *   第 3 步：招架（無盾也有）、格檔（有盾才有，減傷較高）
 *   第 4 步：暴擊、要害
 *   第 5 步：碾壓（來源待定義）
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

export function buildAttackTable(_ctx: AttackTableContext): TableSegment[] {
  // 第 0 步：什麼都沒有，每一刀都實打實命中
  return [{ outcome: '命中', width: 1 }];
}

export function rollOutcome(table: TableSegment[], rng: Rng): AttackOutcome {
  let roll = rng();
  for (const segment of table) {
    roll -= segment.width;
    if (roll < 0) return segment.outcome;
  }
  return table[table.length - 1]?.outcome ?? '命中';
}
