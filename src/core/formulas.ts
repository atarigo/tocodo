/**
 * 攻速（已定案 2026-06-12）：百分比＋飽和曲線，跟躲避同一套語言。
 * 出手間隔 ＝ 武器基礎間隔 ÷（1 ＋ 加速）
 * 加速 ＝ 60% × 敏捷 ÷（敏捷 ＋ 128）        ← 255 點約 +40% 攻速
 * 所有武器等比受益，武器個性不被屬性洗掉；
 * 槍類「射速只看武器」＝由武器宣告不吃敏捷。
 */
const HASTE_CAP = 0.6;
const HASTE_K = 128;

export function hasteBonus(agi: number): number {
  return (HASTE_CAP * agi) / (agi + HASTE_K);
}

export function attackInterval(baseInterval: number, agi: number, agiApplies = true): number {
  return agiApplies ? baseInterval / (1 + hasteBonus(agi)) : baseInterval;
}
