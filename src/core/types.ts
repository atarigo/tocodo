/** 技能的流派分類，未來供協同裝備、偉業條件等掛勾 */
export type Tag = '物理' | '火焰' | '冰霜' | '血祭' | '槍械' | '治癒';

/** 六主屬性 */
export interface Attributes {
  str: number; // 力量
  vit: number; // 體質
  agi: number; // 敏捷
  dex: number; // 靈巧
  wil: number; // 意志
  luk: number; // 幸運
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

export type WeaponKind = '近戰' | '槍' | '弓' | '法杖';

export interface Weapon extends Priced {
  id: string;
  name: string;
  rank: Rank;
  kind: WeaponKind;
  /** 大小傷：浮動區間 [最小, 最大] */
  damage: [number, number];
  /** 普攻基礎間隔（秒） */
  interval: number;
  /** 普攻傷害 += 力量 × 係數（槍類為 0） */
  strScaling: number;
  /** 出手速度是否吃敏捷（槍類只看武器） */
  agiSpeed: boolean;
  /** 大小傷是否吃發揮度（槍類不吃） */
  dexSpread: boolean;
  /** 法杖類特效 */
  castTimeMult?: number;
  mpCostMult?: number;
  description: string;
}

export type StatusKind = 'dot' | 'stun' | 'slow' | 'defDown';

export interface StatusDef {
  /** 同名效果只會存在一份（高優先度取代低優先度） */
  id: string;
  kind: StatusKind;
  /** 意志抵抗縮短持續；感染類另由體質減低強度 */
  resistedBy: 'wil' | 'vit';
  description: string;
}

export interface StatusApplication {
  statusId: string;
  /** 效果覆蓋的優先度，各技能自行設計 */
  priority: number;
  /** 秒 */
  duration: number;
  /** dot = 每秒傷害；slow = 間隔增加比例；defDown = 減算扣減 */
  magnitude: number;
}

export interface SkillDamage {
  base: number;
  /** 吃武器傷害區間的倍率（不吃武器則省略） */
  weaponMult?: number;
  /** 武器部分是否吃發揮度（近戰技通常不吃 = 靈巧不影響大小傷） */
  spread?: boolean;
  /** 每點屬性的增傷係數，由各技能自行宣告 */
  scaling?: Partial<Attributes>;
  /** 穿透：不計減算（−），仍吃減成（％） */
  pierce?: boolean;
  /** 真傷：不計任何防禦 */
  trueDamage?: boolean;
  canCrit?: boolean;
}

export interface Skill extends Priced {
  id: string;
  name: string;
  rank: Rank;
  tag: Tag;
  /** 需要特定武器類型才能施放 */
  weaponKind?: WeaponKind;
  /** 秒；0 = 瞬發 */
  castTime: number;
  /** 秒 */
  cooldown: number;
  mpCost: number;
  /** 命中判定吃哪個屬性；null = 必中（自身效果類） */
  hitAttr: 'agi' | 'dex' | null;
  damage?: SkillDamage;
  heal?: { base: number; scaling?: Partial<Attributes> };
  applies?: StatusApplication[];
  description: string;
}

/** 防禦兩段式：減算（−）與減成（％）；招架另有專屬減傷 */
export interface DefenseProfile {
  flat: number;
  pct: number;
  parryFlat: number;
  parryPct: number;
}

/** 戰鬥模擬器的輸入單位，與養成、敵人生成解耦 */
export interface Unit {
  name: string;
  attrs: Attributes;
  defense: DefenseProfile;
  weapon: Weapon;
  skills: Skill[];
  /** 世界效果等全域加成（1 = 無加成） */
  damageMult: number;
}
