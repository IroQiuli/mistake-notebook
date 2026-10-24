import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating as FsrsRating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import type { Card, CardState, Rating } from './types';
import { intervalFactor } from './weight';

const DAY = 24 * 3600 * 1000;

/**
 * 考研错题本按天（学习日）进行长程间隔复习，不采用生词卡单日内短步长循环 (1m/5m/10m)，
 * 因此关闭 enable_short_term，使四档评分直接以整天推进 (至少明天)，杜绝评完仍落回「今天」。
 */
const engine = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: false,
    enable_short_term: false,
  })
);

const GRADE: Record<Rating, Grade> = {
  1: FsrsRating.Again,
  2: FsrsRating.Hard,
  3: FsrsRating.Good,
  4: FsrsRating.Easy,
};

function toState(s: CardState): State {
  switch (s) {
    case 0:
      return State.New;
    case 1:
      return State.Learning;
    case 2:
      return State.Review;
    default:
      return State.Relearning;
  }
}

function fromState(s: State): CardState {
  switch (s) {
    case State.New:
      return 0;
    case State.Learning:
      return 1;
    case State.Review:
      return 2;
    default:
      return 3;
  }
}

function toFsrs(c: Card): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    reps: c.reps,
    lapses: c.lapses,
    state: toState(c.state),
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
    learning_steps: c.learningSteps,
  };
}

function fromFsrs(problemId: string, c: FsrsCard): Card {
  return {
    problemId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: fromState(c.state),
    lastReview: c.last_review ? new Date(c.last_review).getTime() : undefined,
    learningSteps: c.learning_steps ?? 0,
  };
}

export function newCard(now: number, problemId = ''): Card {
  const card = fromFsrs(problemId, createEmptyCard(new Date(now)));
  card.due = now;
  return card;
}

export interface RateResult {
  card: Card;
  nextDue: number;
  prevDue: number;
  prevState: number;
}

export function applyRating(
  card: Card,
  rating: Rating,
  now: number,
  weight?: number
): RateResult {
  const result = engine.next(toFsrs(card), new Date(now), GRADE[rating]);
  const next = fromFsrs(card.problemId, result.card);
  next.due = applyWeightToDue(next.due, now, weight);
  // 确保评分后 next.due 至少在明天（>= now + DAY），绝不落入今天
  if (next.due < now + DAY) {
    next.due = now + DAY;
  }
  return { card: next, nextDue: next.due, prevDue: card.due, prevState: card.state };
}

/**
 * 用权重缩放 FSRS 给出的间隔：权重低就提前，权重高就推后。
 * 考研错题复习以天为最小单位，最低间隔保证为 1 天（即明天），绝不落回今天。
 */
function applyWeightToDue(due: number, now: number, weight?: number): number {
  const rawDays = (due - now) / DAY;
  if (!Number.isFinite(rawDays)) return now + DAY;
  const days = Math.max(1, Math.round(rawDays));
  const scaled = Math.max(1, Math.round(days * intervalFactor(weight)));
  return now + scaled * DAY;
}

export function previewIntervals(card: Card, now: number, weight?: number): Record<Rating, number> {
  const scheduling = engine.repeat(toFsrs(card), new Date(now));
  const at = (r: Rating) => applyWeightToDue(scheduling[GRADE[r]].card.due.getTime(), now, weight);
  const p1 = at(1);
  let p2 = at(2);
  let p3 = at(3);
  let p4 = at(4);

  // 严格阶梯递增：忘记 < 困难 < 良好 < 简单，且各档最少差 1 天
  if (p2 <= p1) p2 = p1 + DAY;
  if (p3 <= p2) p3 = p2 + DAY;
  if (p4 <= p3) p4 = p3 + DAY;

  return { 1: p1, 2: p2, 3: p3, 4: p4 };
}

/** 当前时刻「还记得」的预测概率（0–1）。新题/没复习过返回 0 */
export function retrievability(card: Card, now: number): number {
  if (card.state === 0 || !card.lastReview) return 0;
  const value = engine.get_retrievability(toFsrs(card), new Date(now), false);
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}
