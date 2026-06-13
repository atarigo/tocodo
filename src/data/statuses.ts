/**
 * 已退役：狀態定義移至 src/core/effectRegistry.ts（效果名錄）。
 * 此檔僅保留轉出口，避免外部舊引用立刻爆炸；新程式請直接 import effectRegistry。
 */
export { EFFECTS, EFFECT_BY_NAME } from '../core/effectRegistry.js';
