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
  /** 攻方可否暴擊（槍不可——槍手的幸運只剩躲避） */
  attackerCanCrit?: boolean;
  /** 碾壓率：頭目普攻限定，預設 15%、各頭目可自訂；技能與一般敵人為 0 */
  attackerCrushRate?: number;
  /** 此次攻擊可否被招架（近戰可；射擊、法術撥不開）——由攻擊宣告 */
  canBeParried?: boolean;
  /** 此次攻擊可否被格檔（盾牌連火球都擋得住）——由攻擊宣告 */
  canBeBlocked?: boolean;
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

// ─ 閃避（已定案 2026-06-12）─
// 原則：防守天生吃虧——防禦是減傷不是抵銷，不能有靠屬性無解的全防流；
// 但敏捷不加傷害、是純減傷投資，所以也不能被靈巧完全吃掉。
// 閃避 =（40% × 守方敏捷 ÷ 255）×（1 − 0.5 × 攻方靈巧 ÷ 255）
// 敏捷滿 vs 靈巧 0 → 40%；敏捷滿 vs 靈巧滿 → 20%（壓制上限是砍半）。
const DODGE_CAP = 0.4;
const DODGE_SUPPRESS_CAP = 0.5;

export function dodgeWidth(defenderAgi: number, attackerDex: number): number {
  const base = (DODGE_CAP * defenderAgi) / 255;
  const suppression = 1 - (DODGE_SUPPRESS_CAP * attackerDex) / 255;
  return base * suppression;
}

// ─ 暴擊（已定案 2026-06-12）─
// 線性成長：暴擊在 bar 尾端、會被守方防禦段擠壓，有天然反制，
// 不像躲避需要曲線自我節制。幸運 255 → 30%。
// 要害已從設計中移除（2026-06-12）；倍率單純 ×1.5，不再複雜化。
const CRIT_CAP = 0.3;
export const CRIT_MULTIPLIER = 1.5;

export function critWidth(luk: number): number {
  return (CRIT_CAP * luk) / 255;
}

export function buildAttackTable(ctx: AttackTableContext): TableSegment[] {
  // 依優先序填入；空間不夠時後面的段被擠掉，普通命中拿剩餘空間
  const queued: TableSegment[] = [
    {
      outcome: '閃避',
      width: dodgeWidth(ctx.defender.agi, ctx.attacker.dex),
    },
    {
      outcome: '躲避',
      width: evadeWidth(ctx.defender.luk),
    },
    {
      outcome: '招架',
      width: (ctx.canBeParried ?? true) ? Math.max(0, ctx.defenderParryRate) : 0,
    },
    {
      outcome: '格檔',
      width: (ctx.canBeBlocked ?? true) ? Math.max(0, ctx.defenderBlockRate) : 0,
    },
    // 攻方特殊結果：防禦段堆高時，普通命中先歸零 → 碾壓被擠出 → 最後才是暴擊
    {
      outcome: '暴擊',
      width: (ctx.attackerCanCrit ?? true) ? critWidth(ctx.attacker.luk) : 0,
    },
    {
      outcome: '碾壓',
      width: Math.max(0, ctx.attackerCrushRate ?? 0),
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

// ─ 第二階段：傷害計算（已定案 2026-06-12）─
// 1. 基礎傷害（平衡擲骰＋力量）
// 2. 攻方增傷先乘：暴擊 ×1.5／碾壓 ×2／技能倍率與增傷效果 → 得到「來襲傷害」
//    （增傷先乘的理由：暴擊要能幫助破防，混進減傷率會讓暴擊流對高甲目標報廢）
// 3. 破防判定：來襲傷害 > 護甲值總和？未破防 → 傷害 1（暫定）、該次攻擊特效不發動（例外由技能宣告）
// 4. 減算（− 護甲值總和）→ 5. 減成（× 1 − 減傷率）→ 6. 招架/格檔折減
// 真傷不走這裡：第一階段有過就打技能宣告的固定值，不計增傷、不計任何防禦與折減。
//
// 數值修飾統一規則：裝備詞綴先改裝備自己的值（組裝時烤死）；
// 實際值 ＝（基準值 ＋ 固定值效果加總）×（1 ＋ 比例效果加總），最低 0。
// buff、debuff、攻擊當下特效三種來源一起加總（攻擊特效不是 debuff，可與 debuff 疊加）。

export interface DefenseValues {
  /** 護甲值總和（減算）：裝備詞綴已烤入、效果加總後的最終值，最低 0 */
  armor: number;
  /** 減傷率（減成）：0〜1，效果加總後的最終值，最低 0 */
  reductionRate: number;
}

export interface DamageResult {
  damage: number;
  /** 破防＝來襲傷害 > 護甲值總和；未破防時該次攻擊的特效不發動 */
  brokeDefense: boolean;
}

export function resolveDamage(
  outcome: AttackOutcome,
  base: number,
  defense: DefenseValues,
  /** 攻方增傷效果（技能倍率、增傷 buff 比例加總後），1 ＝ 無增傷 */
  damageBonus = 1,
): DamageResult {
  if (outcome === '閃避' || outcome === '躲避') return { damage: 0, brokeDefense: false };
  let incoming = base * damageBonus;
  if (outcome === '暴擊') incoming *= CRIT_MULTIPLIER;
  if (outcome === '碾壓') incoming *= CRUSH_MULTIPLIER;
  if (incoming <= defense.armor) return { damage: 1, brokeDefense: false };
  let damage = (incoming - defense.armor) * (1 - defense.reductionRate);
  if (outcome === '招架') damage *= 1 - PARRY_DAMAGE_REDUCTION;
  if (outcome === '格檔') damage *= 1 - BLOCK_DAMAGE_REDUCTION;
  return { damage: Math.max(1, Math.round(damage)), brokeDefense: true };
}
