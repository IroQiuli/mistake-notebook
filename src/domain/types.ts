export type ID = string;

/** 自评四档，与 FSRS 的 Again / Hard / Good / Easy 一一对应 */
export type Rating = 1 | 2 | 3 | 4;

export const RATING_LABEL: Record<Rating, string> = {
  1: '忘记',
  2: '模糊',
  3: '记得',
  4: '熟练',
};

/** 0 New · 1 Learning · 2 Review · 3 Relearning */
export type CardState = 0 | 1 | 2 | 3;

export const CARD_STATE_LABEL: Record<CardState, string> = {
  0: '新题',
  1: '学习中',
  2: '复习中',
  3: '重学中',
};

export interface Subject {
  id: ID;
  name: string;
  color: string;
  order: number;
  archived: 0 | 1;
}

export interface Chapter {
  id: ID;
  subjectId: ID;
  name: string;
  order: number;
}

export interface Topic {
  id: ID;
  subjectId: ID;
  name: string;
  usageCount: number;
}

export interface Problem {
  id: ID;
  subjectId: ID;
  chapterId: ID;
  topicIds: ID[];

  stemAssetId: ID;
  /** 列表用缩略图，缺省时回退到 stemAssetId */
  thumbAssetId?: ID;
  answerAssetIds: ID[];
  stemInkId?: ID;
  wrongNote: string;
  wrongInkId?: ID;

  difficulty: 1 | 2 | 3 | 4 | 5;
  sourceYear?: number;
  sourcePaper?: string;
  sourceNo?: string;

  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  missingAsset?: 0 | 1;
}

export interface Card {
  problemId: ID;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: number;
  learningSteps: number;
}

export interface ReviewLog {
  id: ID;
  problemId: ID;
  rating: 0 | Rating;
  reviewedAt: number;
  durationMs: number;
  prevDue: number;
  nextDue: number;
  prevState: number;
  nextState: number;
}

export type AssetKind = 'stem' | 'answer' | 'thumb' | 'scratch-export';

export interface Asset {
  id: ID;
  kind: AssetKind;
  sourceAssetId?: ID;
  /** 图片二进制。用 ArrayBuffer 而不是 Blob：IndexedDB 原生支持，跨环境一致 */
  data: ArrayBuffer;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  createdAt: number;
}

export type Tool = 'pen' | 'highlighter';

/** 点坐标归一化到 0–1，压力 0–1 */
export type InkPoint = [x: number, y: number, pressure: number];

export interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  /** 基准宽度，按画布宽度的比例记录 */
  width: number;
  points: InkPoint[];
}

export type InkOwner = 'problem-stem' | 'problem-wrong' | 'attempt' | 'scratch';

export interface Ink {
  id: ID;
  ownerType: InkOwner;
  ownerId: ID;
  aspect: number;
  strokes: Stroke[];
  createdAt: number;
  updatedAt: number;
}

export interface Scratch {
  id: ID;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type ProblemStatus = 'all' | 'due' | 'new' | 'archived';
