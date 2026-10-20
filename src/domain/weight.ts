import type { Mastery, Problem } from './types';

/**
 * 权重：0~10，越高 = 越熟 = 可以排得更靠后。
 * 它是「主观把握」的量化，和 FSRS 的记忆曲线一起决定下次复习时间。
 */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 10;
export const DEFAULT_WEIGHT = 5;

export function clampWeight(w: number | undefined): number {
  if (w === undefined || Number.isNaN(w)) return DEFAULT_WEIGHT;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(w)));
}

/** 初始权重：完全不会 2 → 掌握 8，未分级给 5 */
export function weightFromMastery(mastery?: Mastery): number {
  switch (mastery) {
    case 1:
      return 2;
    case 2:
      return 4;
    case 3:
      return 6;
    case 4:
      return 8;
    default:
      return DEFAULT_WEIGHT;
  }
}

/** 四档评分对权重的增减 */
export const RATING_WEIGHT_DELTA: Record<1 | 2 | 3 | 4, number> = {
  1: -2,
  2: -1,
  3: 1,
  4: 2,
};

export function adjustWeight(weight: number | undefined, rating: 1 | 2 | 3 | 4): number {
  return clampWeight(clampWeight(weight) + RATING_WEIGHT_DELTA[rating]);
}

/**
 * 权重 → 排期倍数。
 * 权重 0 时把间隔压到 0.55 倍（更勤），权重 10 时拉到 1.45 倍（更少打扰）。
 */
export function intervalFactor(weight: number | undefined): number {
  return 0.55 + (clampWeight(weight) / WEIGHT_MAX) * 0.9;
}

/**
 * 新题第一次复习安排在几天后：
 * 掌握程度定基准（不会 1 天 / 不熟 3 天 / 一般 7 天 / 掌握 14 天），难度再微调。
 */
export function firstReviewDays(mastery: Mastery | undefined, difficulty: number): number {
  const base =
    mastery === 1 ? 1 : mastery === 2 ? 3 : mastery === 3 ? 7 : mastery === 4 ? 14 : 3;
  const diffAdj = difficulty >= 4 ? -1 : difficulty <= 2 ? 2 : 0;
  return Math.max(1, base + diffAdj);
}

/** 题目的有效权重（老数据没有字段时按 5 算） */
export function weightOf(problem: Pick<Problem, 'weight'>): number {
  return clampWeight(problem.weight);
}

export function weightLabel(weight: number): string {
  if (weight <= 2) return '重点';
  if (weight <= 4) return '偏弱';
  if (weight <= 6) return '一般';
  if (weight <= 8) return '较熟';
  return '很熟';
}
