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
 *   已定案：閃避（敏捷，可被靈巧壓制一半）、躲避（守方幸運）、暴擊（攻方幸運）、
 *           招架（武器提供 5〜25%，減傷 30%，擋不住效果）、
 *           格檔（盾牌提供 30〜45%，減傷 60%，可擋單體鎖定效果——待 buff/debuff）
 *   待定案：碾壓（提案：頭目自帶攻擊段 15〜25%、傷害 ×2，排隊列最末，
 *           防禦堆高時在普通命中歸零後第一個被擠出——坦克玩法的本體）
 *   已移除：要害、落空（基礎落空）
 */
export type AttackOutcome =
  | '閃避'
  | '躲避'
  | '招架'
  | '格檔'
  | '暴擊'
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
  /** 招架率：一般武器提供（約 5%〜25%），屬性不提供；可被法術 buff/debuff 增減 */
  defenderParryRate: number;
  /** 格檔率：只有盾牌提供（約 30%〜45%），0 ＝ 沒有盾；可被法術 buff/debuff 增減 */
  defenderBlockRate: number;
  /** 技能或攻擊的 tag（決定閃避/招架/暴擊是否啟用） */
  skillTags: string[];
  /** 攻擊者的 tag（含 boss_source 則啟用碾壓） */
  attackerTags: string[];
  /** 技能宣告的 canCrit（預設依武器 tag 決定） */
  skillCanCrit: boolean;
  /** 碾壓率：頭目普攻限定，預設 15%、各頭目可自訂；技能與一般敵人為 0 */
  attackerCrushRate?: number;
  /** 守方行動不能（冰凍／暈眩）：不能閃避、招架、格檔；躲避（幸運）仍在 */
  defenderIncapacitated?: boolean;
}

/** 頭目碾壓的統一預設值（各頭目可自行覆寫） */
export const BOSS_CRUSH_RATE = 0.15;
export const CRUSH_MULTIPLIER = 2;

// ─ 招架與格檔（已定案 2026-06-12）─
// 率與減傷都來自技能或裝備，屬性不提供。
/** 招架：減免傷害 30%，無法阻止效果發動 */
export const PARRY_DAMAGE_REDUCTION = 0.3;
/** 格檔：固定減免傷害 60%；可阻止「單體鎖定」效果（範圍效果擋不住）——該機制待 buff/debuff 系統再實作 */
export const BLOCK_DAMAGE_REDUCTION = 0.6;

// ─ 躲避（已定案 2026-06-12）─
// 躲避 ＝ 上限 × 幸運 ÷ (幸運 ＋ K)：飽和曲線，前段便宜、後段昂貴。
// 幸運 128 → 6%、255 → 8%。不可被任何機制壓縮——命中永遠堆不滿的原因，
// 因此它必須是防禦段裡最小的一塊。
const EVADE_CAP = 0.12;
const EVADE_K = 128;

export function evadeWidth(luk: number): number {
  return (EVADE_CAP * luk) / (luk + EVADE_K);
}

// ─ 閃避（飽和曲線）─
// 閃避 = 上限 × agi ÷ (agi + K)，最高接近 40%
// 壓制 = 上限 × dex ÷ (dex + K)，最高壓制接近 50%
// 255 敏捷 vs 0 靈巧 → ~33%；255 敏捷 vs 255 靈巧 → ~17%
const DODGE_CAP = 0.4;
const DODGE_K = 128;
const DODGE_SUPPRESS_CAP = 0.5;
const DODGE_SUPPRESS_K = 128;

export function dodgeWidth(defenderAgi: number, attackerDex: number): number {
  const base = (DODGE_CAP * defenderAgi) / (defenderAgi + DODGE_K);
  const suppression = 1 - (DODGE_SUPPRESS_CAP * attackerDex) / (attackerDex + DODGE_SUPPRESS_K);
  return base * suppression;
}

// ─ 暴擊（飽和曲線）─
// 暴擊 = 上限 × luk ÷ (luk + K)，最高接近 30%
const CRIT_CAP = 0.3;
const CRIT_K = 128;
export const CRIT_MULTIPLIER = 1.5;

export function critWidth(luk: number): number {
  return (CRIT_CAP * luk) / (luk + CRIT_K);
}

export function buildAttackTable(ctx: AttackTableContext): TableSegment[] {
  const incapacitated = ctx.defenderIncapacitated ?? false;
  const tags = ctx.skillTags;
  const isSpell = tags.includes('spell');
  const isMelee = tags.includes('melee');
  const isGun = tags.includes('gun');
  const isBoss = ctx.attackerTags.includes('boss_source');

  const queued: TableSegment[] = [
    {
      outcome: '閃避',
      width: !isSpell && !incapacitated ? dodgeWidth(ctx.defender.agi, ctx.attacker.dex) : 0,
    },
    {
      outcome: '躲避',
      width: !isSpell ? evadeWidth(ctx.defender.luk) : 0,
    },
    {
      outcome: '招架',
      width: isMelee && !incapacitated ? Math.max(0, ctx.defenderParryRate) : 0,
    },
    {
      outcome: '格檔',
      width: !incapacitated ? Math.max(0, ctx.defenderBlockRate) : 0,
    },
    {
      outcome: '暴擊',
      width: ctx.skillCanCrit && !isGun ? critWidth(ctx.attacker.luk) : 0,
    },
    {
      outcome: '碾壓',
      width: isBoss ? Math.max(0, ctx.attackerCrushRate ?? BOSS_CRUSH_RATE) : 0,
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

