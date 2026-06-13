/** 五階制：所有內容（武器、裝備、技能、效果優先度、價格）都掛階級 */
export type Rank = 'D' | 'C' | 'B' | 'A' | 'S';

/** 效果優先度錨點：D級流血 = 10、S級流血 = 230（定案範例），中間內插 */
export const RANK_PRIORITY: Record<Rank, number> = { D: 10, C: 40, B: 90, A: 150, S: 230 };

/** 階級基準價：內容設計時的參考值，實際價格是各內容的個別欄位 */
export const RANK_PRICE: Record<Rank, number> = { D: 50, C: 150, B: 400, A: 1000, S: 2500 };

/**
 * 價格欄位：沒有 price ＝ 一般商店不出售（通常較強或特殊，只能副本取得）；
 * secretPrice 只在秘密商店顯示（秘密點數計價）。
 */
export interface Priced {
  price?: number;
  secretPrice?: number;
}

/** 六主屬性：範圍 0〜255、起始 10；沒有預設數值，基本狀態全由屬性或裝備提供 */
export interface Attributes {
  str: number; // 力量：傷害固定值直加
  vit: number; // 體質：生命 ×10、毒系附加成功率折減
  agi: number; // 敏捷：攻速（依武器宣告）、閃避
  dex: number; // 靈巧：命中（壓制閃避）、平衡放大
  wil: number; // 意志：精神 ×5、debuff 縮時
  luk: number; // 幸運：暴擊（攻）、躲避（守）
}

export type AttrKey = keyof Attributes;

export const ATTR_NAMES: Record<AttrKey, string> = {
  str: '力量',
  vit: '體質',
  agi: '敏捷',
  dex: '靈巧',
  wil: '意志',
  luk: '幸運',
};

export type WeaponKind = '近戰' | '槍' | '弓' | '法杖';

export interface Weapon extends Priced {
  id: string;
  name: string;
  rank: Rank;
  kind: WeaponKind;
  /** 大小傷區間 */
  damage: [number, number];
  /** 武器自帶平衡（0〜0.8）：擲骰中心的位置 */
  balance: number;
  /** 普攻基礎出手間隔（秒） */
  interval: number;
  /** 傷害吃不吃力量（槍不吃） */
  strApplies: boolean;
  /** 攻速吃不吃敏捷（槍不吃） */
  agiApplies: boolean;
  /** 平衡吃不吃靈巧放大（槍不吃） */
  dexAmp: boolean;
  /** 招架率：一般武器 5%〜25% */
  parryRate: number;
  /** 法杖特效 */
  castTimeMult?: number;
  mpCostMult?: number;
  description: string;
}

export type GearSlot = '副手' | '防具' | '飾品';

export interface Gear extends Priced {
  id: string;
  name: string;
  rank: Rank;
  slot: GearSlot;
  attrs?: Partial<Attributes>;
  /** 護甲值（減算用） */
  armor?: number;
  /** 減傷率（0〜1） */
  reductionRate?: number;
  /** 格檔率：只有盾牌會給（30%〜45%） */
  blockRate?: number;
  description: string;
}

/** 技能附加的效果（名稱對應效果名錄） */
export interface EffectSpec {
  name: string;
  /** 點數型填點數、比例型填 %、跳動型填每秒量；開關型免填 */
  value: number;
  /** 秒 */
  duration: number;
  /** 覆蓋優先度（慣例＝技能階級的 RANK_PRIORITY） */
  priority: number;
}

export interface SkillDamage {
  /** 吃武器大小傷的倍率 */
  weaponMult?: number;
  /** 固定基礎值 */
  base?: number;
  /** 各屬性增傷係數（每點加多少） */
  scaling?: Partial<Attributes>;
  /** 穿透：無視護甲值總和（必定破防），仍吃減傷率 */
  pierce?: boolean;
  /** 真傷：骰到什麼都算命中，打固定值，不計增傷、防禦與折減 */
  trueDamage?: number;
  canCrit?: boolean;
}

export interface Skill extends Priced {
  id: string;
  name: string;
  rank: Rank;
  /** 需要特定武器類型 */
  weaponKind?: WeaponKind;
  /** 秒；0 ＝ 瞬發 */
  castTime: number;
  cooldown: number;
  mpCost: number;
  /** 此攻擊可否被招架（近戰可；射擊、法術撥不開） */
  canBeParried: boolean;
  /** 此攻擊可否被格檔（盾牌連火球都擋得住） */
  canBeBlocked: boolean;
  damage?: SkillDamage;
  heal?: { base: number; scaling?: Partial<Attributes> };
  applies?: EffectSpec[];
  /** 未破防仍可附加效果（少數例外，例如純 debuff 技） */
  effectsIgnoreBreak?: boolean;
  description: string;
}

/** 戰鬥單位：養成／敵人生成組裝後的結果，引擎只認這個 */
export interface Unit {
  name: string;
  attrs: Attributes;
  /** null ＝ 空手：沒有普攻 */
  weapon: Weapon | null;
  /** 招架率（武器提供）、格檔率（盾牌提供） */
  parryRate: number;
  blockRate: number;
  /** 護甲值總和（裝備加總）與減傷率 */
  armor: number;
  reductionRate: number;
  /** 碾壓率：頭目普攻限定 */
  crushRate: number;
  /** 增傷倍率（世界效果等），1 ＝ 無 */
  damageBonus: number;
  skills: Skill[];
}
