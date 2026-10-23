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

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
