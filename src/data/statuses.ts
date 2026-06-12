import type { StatusDef } from '../core/types.js';

/**
 * 狀態效果定義。同名效果只會存在一份（高優先度取代低優先度）；
 * 「流血」與「失血」是兩種不相關的效果，可並存。
 */
export const STATUSES: readonly StatusDef[] = [
  { id: '流血', kind: 'dot', resistedBy: 'wil', description: '每秒受到傷害' },
  { id: '燃燒', kind: 'dot', resistedBy: 'wil', description: '每秒受到火焰傷害' },
  { id: '感染', kind: 'dot', resistedBy: 'vit', description: '每秒受到傷害，由體質減低強度' },
  { id: '昏迷', kind: 'stun', resistedBy: 'wil', description: '無法行動' },
  { id: '冰緩', kind: 'slow', resistedBy: 'wil', description: '出手間隔增加' },
  { id: '破甲', kind: 'defDown', resistedBy: 'wil', description: '防禦減算降低' },
];

export const STATUS_BY_ID = new Map(STATUSES.map((s) => [s.id, s]));

export function getStatus(id: string): StatusDef {
  const def = STATUS_BY_ID.get(id);
  if (!def) throw new Error(`未知狀態 id: ${id}`);
  return def;
}
