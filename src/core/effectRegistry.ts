/**
 * 效果名錄（已定案 2026-06-12，邊做邊加）。
 *
 * 機制只有三類，名稱是內容資料：
 *  - 數值修飾：目標數值 ± 點數或比例，持續 y 秒（統一修飾規則：固定值加總、比例加總、最低 0）
 *  - 持續跳動：每秒結算生命增減，持續 y 秒；不同名可並存疊加（出血＋流血＋中毒…）
 *  - 狀態開關：特殊行為，每個單獨設計，省著加
 *
 * 通用規則：
 *  - 所有 debuff 的持續時間受意志影響，滿點意志 −70%（見 formulas.debuffDuration）
 *  - 毒系：體質影響「附加成功率」，滿體質成功率 ×0.7；傷害不受體質影響
 *  - 同名唯一：高級覆蓋低級、同級刷新時間、低級無效但照樣轉冷卻扣精神
 */
export type EffectKind = '數值修飾' | '持續跳動' | '狀態開關';

/** 數值修飾型可改的目標（之後隨管線擴充） */
export type ModifiableValue = '護甲值總和' | '減傷率' | '詠唱時間' | '攻速';

export interface EffectDef {
  name: string;
  kind: EffectKind;
  /** 數值修飾型：目標、單位與方向 */
  modifier?: {
    target: ModifiableValue;
    unit: '點' | '比例';
    /** +1 ＝ buff、−1 ＝ debuff */
    direction: 1 | -1;
  };
  /** 持續跳動型：每秒生命增減 */
  tick?: {
    unit: '點' | '比例';
    direction: 1 | -1;
    /** 毒系：附加時吃體質成功率折減 */
    poison?: boolean;
  };
  notes?: string;
}

export const EFFECTS: readonly EffectDef[] = [
  // ─ 數值修飾型 ─
  { name: '破甲', kind: '數值修飾', modifier: { target: '護甲值總和', unit: '點', direction: -1 } },
  { name: '佑甲', kind: '數值修飾', modifier: { target: '護甲值總和', unit: '點', direction: 1 } },
  { name: '蝕甲', kind: '數值修飾', modifier: { target: '減傷率', unit: '比例', direction: -1 } },
  { name: '耀甲', kind: '數值修飾', modifier: { target: '減傷率', unit: '比例', direction: 1 } },
  { name: '恍神', kind: '數值修飾', modifier: { target: '詠唱時間', unit: '比例', direction: -1 }, notes: '詠唱變慢' },
  { name: '專注', kind: '數值修飾', modifier: { target: '詠唱時間', unit: '比例', direction: 1 }, notes: '詠唱變快' },
  { name: '減速', kind: '數值修飾', modifier: { target: '攻速', unit: '比例', direction: -1 } },
  { name: '加速', kind: '數值修飾', modifier: { target: '攻速', unit: '比例', direction: 1 } },
  { name: '冰緩', kind: '數值修飾', modifier: { target: '攻速', unit: '比例', direction: -1 }, notes: '＝減速的冰系名稱（尚無移動設計）' },
  // ─ 持續跳動型（不同名可並存疊加） ─
  { name: '出血', kind: '持續跳動', tick: { unit: '點', direction: -1 } },
  { name: '流血', kind: '持續跳動', tick: { unit: '比例', direction: -1 } },
  { name: '中毒', kind: '持續跳動', tick: { unit: '點', direction: -1, poison: true } },
  { name: '劇毒', kind: '持續跳動', tick: { unit: '比例', direction: -1, poison: true } },
  { name: '燃燒', kind: '持續跳動', tick: { unit: '點', direction: -1 }, notes: '火系；比例版名稱待定' },
  { name: '恢復', kind: '持續跳動', tick: { unit: '點', direction: 1 } },
  { name: '治療', kind: '持續跳動', tick: { unit: '比例', direction: 1 } },
  // ─ 狀態開關型（每個單獨設計） ─
  {
    name: '冰凍',
    kind: '狀態開關',
    notes: '行動停止；累積受到最大生命 20% 傷害破冰（暫定解讀）；期間不能閃避、招架、格檔；附加時中斷詠唱',
  },
  { name: '暈眩', kind: '狀態開關', notes: '同冰凍' },
  { name: '沉默', kind: '狀態開關', notes: '時間內無法使用任何技能' },
];

export const EFFECT_BY_NAME = new Map(EFFECTS.map((e) => [e.name, e]));
