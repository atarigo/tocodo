// ─ 效果抗性（已定案 2026-06-12）─
// 所有 debuff 的持續時間受意志影響：滿點意志 −70%（線性）。
export function debuffDuration(baseDuration: number, wil: number): number {
  return baseDuration * (1 - (0.7 * wil) / 255);
}

// 毒系（中毒、劇毒）：體質影響「附加成功率」，滿體質成功率 ×0.7（暫定解讀為相對折減）；
// 傷害本身不受體質影響。
export function poisonApplyChance(baseChance: number, vit: number): number {
  return baseChance * (1 - (0.3 * vit) / 255);
}

// ─ 生命與精神（已定案 2026-06-12）─
// 沒有基礎值：全部由屬性提供（起始 10 → 生命 100、精神 50）。
export function maxHp(vit: number): number {
  return vit * 10;
}

export function maxMp(wil: number): number {
  return wil * 5;
}

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

/**
 * 平衡（Mabinogi 式）：武器自帶平衡值（越好的武器越高），
 * 靈巧以「乘法放大」加強它，上限 80%。傷害擲骰是以
 * 「最小傷 ＋ 範圍 × 平衡」為中心的高斯分佈，超出大小傷範圍夾回。
 *
 * 靈巧放大走飽和曲線（低靈巧每點更有效）：
 * 放大率 ＝ 60% × 靈巧 ÷（靈巧＋128）→ 64 點 +20%、128 點 +30%、255 點約 +40%。
 * 鐘形標準差 ＝ 範圍 × 0.2（暫定）。
 */
const BALANCE_CAP = 0.8;
const BALANCE_AMP_CAP = 0.6;
const BALANCE_AMP_K = 128;
const BALANCE_SPREAD = 0.2;

export function effectiveBalance(weaponBalance: number, dex: number): number {
  const amp = (BALANCE_AMP_CAP * dex) / (dex + BALANCE_AMP_K);
  return Math.min(BALANCE_CAP, weaponBalance * (1 + amp));
}

/** Box-Muller：把兩個均勻隨機轉成標準常態 */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function balanceRoll(
  rng: () => number,
  min: number,
  max: number,
  balance: number,
): number {
  const range = max - min;
  const center = min + range * balance;
  const roll = center + gaussian(rng) * range * BALANCE_SPREAD;
  return Math.min(max, Math.max(min, roll));
}
