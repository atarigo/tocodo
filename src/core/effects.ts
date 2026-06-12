import type { StatusApplication } from './types.js';
import { getStatus } from '../data/statuses.js';
import type { Derived } from './attributes.js';

export interface StatusInstance {
  defId: string;
  priority: number;
  magnitude: number;
  expiresAt: number;
  /** dot 專用：下一次跳傷害的時間 */
  nextTickAt?: number;
}

export interface ApplyResult {
  outcome: 'applied' | 'replaced' | 'blocked';
  /** 抵抗後實際的持續秒數 */
  duration: number;
}

/**
 * 效果覆蓋規則：同名效果只會存在一份。
 * 新效果優先度 >= 既有者 → 取代；否則無法覆蓋（blocked）。
 * 意志縮短持續時間；感染類（resistedBy: vit）另由體質減低強度。
 */
export function applyStatus(
  statuses: StatusInstance[],
  app: StatusApplication,
  now: number,
  targetDerived: Derived,
): ApplyResult {
  const def = getStatus(app.statusId);
  const duration = app.duration * (1 - targetDerived.statusResist);
  let magnitude = app.magnitude;
  if (def.resistedBy === 'vit') {
    magnitude = magnitude * (1 - targetDerived.infectionResist);
  }

  const existingIndex = statuses.findIndex((s) => s.defId === app.statusId);
  if (existingIndex >= 0 && statuses[existingIndex].priority > app.priority) {
    return { outcome: 'blocked', duration: 0 };
  }

  const instance: StatusInstance = {
    defId: app.statusId,
    priority: app.priority,
    magnitude,
    expiresAt: now + duration,
    nextTickAt: def.kind === 'dot' ? now + 1 : undefined,
  };

  if (existingIndex >= 0) {
    statuses[existingIndex] = instance;
    return { outcome: 'replaced', duration };
  }
  statuses.push(instance);
  return { outcome: 'applied', duration };
}

export function purgeExpired(statuses: StatusInstance[], now: number): void {
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i].expiresAt <= now) statuses.splice(i, 1);
  }
}

/** 冰緩等效果的出手間隔倍率 */
export function slowMultiplier(statuses: StatusInstance[]): number {
  return statuses
    .filter((s) => getStatus(s.defId).kind === 'slow')
    .reduce((mult, s) => mult * (1 + s.magnitude), 1);
}

/** 破甲等效果造成的防禦減算扣減 */
export function defFlatReduction(statuses: StatusInstance[]): number {
  return statuses
    .filter((s) => getStatus(s.defId).kind === 'defDown')
    .reduce((sum, s) => sum + s.magnitude, 0);
}

/** 昏迷結束的時間點；未昏迷回傳 null */
export function stunnedUntil(statuses: StatusInstance[], now: number): number | null {
  const stuns = statuses.filter((s) => getStatus(s.defId).kind === 'stun' && s.expiresAt > now);
  if (stuns.length === 0) return null;
  return Math.max(...stuns.map((s) => s.expiresAt));
}
