import type { Card } from './types';

/** 学习日从本地 04:00 开始：凌晨 3 点复习仍算前一天 */
export const DAY_START_HOUR = 4;

export function learningDayStart(t: number): number {
  const d = new Date(t);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

export function learningDayEnd(t: number): number {
  return learningDayStart(t) + 24 * 3600 * 1000;
}

export function dayKey(t: number): string {
  const d = new Date(learningDayStart(t));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 以学习日为单位的整数差，正数表示 future 在未来 */
export function dayDiff(future: number, now: number): number {
  const ms = learningDayStart(future) - learningDayStart(now);
  return Math.round(ms / (24 * 3600 * 1000));
}

export function formatDue(due: number, now: number): string {
  const diff = dayDiff(due, now);
  if (diff < 0) return `逾期 ${-diff} 天`;
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  return `${diff} 天后`;
}

export function isDue(card: Pick<Card, 'due'>, now: number): boolean {
  return card.due <= learningDayEnd(now);
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatToday(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

export function formatDateTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}
