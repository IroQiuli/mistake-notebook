import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  CaptureDraft,
  Card,
  Chapter,
  Ink,
  Problem,
  ReviewLog,
  Scratch,
  Setting,
  Subject,
  Topic,
} from '../domain/types';

export class AppDb extends Dexie {
  subjects!: Table<Subject, string>;
  chapters!: Table<Chapter, string>;
  topics!: Table<Topic, string>;
  problems!: Table<Problem, string>;
  cards!: Table<Card, string>;
  reviewLogs!: Table<ReviewLog, string>;
  assets!: Table<Asset, string>;
  inks!: Table<Ink, string>;
  scratch!: Table<Scratch, string>;
  settings!: Table<Setting, string>;
  drafts!: Table<CaptureDraft, string>;

  constructor() {
    super('cuotiben');
    this.version(1).stores({
      subjects: 'id, order, archived',
      chapters: 'id, subjectId, [subjectId+order]',
      topics: 'id, subjectId, name',
      problems: 'id, subjectId, chapterId, createdAt, archivedAt, *topicIds',
      cards: 'problemId, due, state',
      reviewLogs: 'id, problemId, reviewedAt',
      assets: 'id, kind, createdAt, sourceAssetId',
      inks: 'id, ownerId, ownerType, createdAt',
      scratch: 'id, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      drafts: 'id, createdAt',
    });
  }
}

export const db = new AppDb();

const SETTING_CACHE_PREFIX = 'setting_cache:';

export function getSettingSync<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(SETTING_CACHE_PREFIX + key);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch {
    /* 忽略隐私模式或解析失败 */
  }
  return fallback;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  if (row) {
    try {
      localStorage.setItem(SETTING_CACHE_PREFIX + key, JSON.stringify(row.value));
    } catch {
      /* 忽略 */
    }
    return row.value as T;
  }
  return fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(SETTING_CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* 忽略 */
  }
  await db.settings.put({ key, value });
}
