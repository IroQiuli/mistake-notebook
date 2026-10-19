import { db } from './db';
import { newId } from '../lib/id';
import { newCard } from '../domain/scheduler';
import type { Chapter, Problem, Topic } from '../domain/types';

export type ProblemInput = Omit<
  Problem,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'missingAsset'
>;

export async function createProblem(input: ProblemInput, now = Date.now()): Promise<string> {
  const id = newId();
  const problem: Problem = { ...input, id, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.problems, db.cards, db.topics, async () => {
    await db.problems.add(problem);
    await db.cards.add({ ...newCard(now, id), due: now });
    for (const topicId of input.topicIds) {
      const topic = await db.topics.get(topicId);
      if (topic) await db.topics.update(topicId, { usageCount: topic.usageCount + 1 });
    }
  });
  return id;
}

export async function updateProblem(id: string, patch: Partial<ProblemInput>): Promise<void> {
  await db.problems.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteProblem(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.problems, db.cards, db.reviewLogs, db.inks, db.assets],
    async () => {
      const p = await db.problems.get(id);
      if (p) {
        const assetIds = [p.stemAssetId, ...p.answerAssetIds].filter(Boolean);
        const thumbs = await db.assets.where('sourceAssetId').anyOf(assetIds).toArray();
        await db.assets.bulkDelete([...assetIds, ...thumbs.map((t) => t.id)]);
      }
      await db.inks.where('ownerId').equals(id).delete();
      await db.reviewLogs.where('problemId').equals(id).delete();
      await db.cards.delete(id);
      await db.problems.delete(id);
    }
  );
}

export async function markArchived(id: string, archived: boolean): Promise<void> {
  await db.problems.update(id, {
    archivedAt: archived ? Date.now() : undefined,
    updatedAt: Date.now(),
  });
}

/** 手动改期：直接覆盖卡片到期时间 */
export async function reschedule(id: string, due: number): Promise<void> {
  const now = Date.now();
  await db.cards.update(id, {
    due,
    scheduledDays: Math.max(0, Math.round((due - now) / 86400000)),
  });
}

export async function createChapter(subjectId: string, name: string): Promise<Chapter> {
  const max = await db.chapters.where('subjectId').equals(subjectId).toArray();
  const chapter: Chapter = {
    id: newId(),
    subjectId,
    name: name.trim(),
    order: max.reduce((m, c) => Math.max(m, c.order), -1) + 1,
  };
  await db.chapters.add(chapter);
  return chapter;
}

export async function createTopic(subjectId: string, name: string): Promise<Topic> {
  const trimmed = name.trim();
  const existed = await db.topics
    .where('subjectId')
    .equals(subjectId)
    .filter((t) => t.name === trimmed)
    .first();
  if (existed) return existed;
  const topic: Topic = {
    id: newId(),
    subjectId,
    name: trimmed,
    usageCount: 0,
  };
  await db.topics.add(topic);
  return topic;
}
