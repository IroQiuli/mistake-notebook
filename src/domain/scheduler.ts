import {
  createEmptyCard,
  fsrs,
  Rating as FsrsRating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import type { Card, CardState, Rating } from './types';

/** 目标保留率 90%，关闭随机抖动以保证同一操作得到确定结果 */
const engine = fsrs({ request_retention: 0.9, enable_fuzz: false });

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

export function applyRating(card: Card, rating: Rating, now: number): RateResult {
  const result = engine.next(toFsrs(card), new Date(now), GRADE[rating]);
  const next = fromFsrs(card.problemId, result.card);
  return { card: next, nextDue: next.due, prevDue: card.due, prevState: card.state };
}

export function previewIntervals(card: Card, now: number): Record<Rating, number> {
  const scheduling = engine.repeat(toFsrs(card), new Date(now));
  return {
    1: scheduling[FsrsRating.Again].card.due.getTime(),
    2: scheduling[FsrsRating.Hard].card.due.getTime(),
    3: scheduling[FsrsRating.Good].card.due.getTime(),
    4: scheduling[FsrsRating.Easy].card.due.getTime(),
  };
}

/** 当前时刻「还记得」的预测概率（0–1）。新题/没复习过返回 0 */
export function retrievability(card: Card, now: number): number {
  if (card.state === 0 || !card.lastReview) return 0;
  const value = engine.get_retrievability(toFsrs(card), new Date(now), false);
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}
