import { db } from './db';
import { newId } from '../lib/id';
import { newCard } from '../domain/scheduler';
import { learningDayEnd } from '../domain/time';
import {
  calcInitialDue,
  weightFromMastery,
  clampWeight,
} from '../domain/weight';
import type { Chapter, Problem, Topic } from '../domain/types';

export type ProblemInput = Omit<
  Problem,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'missingAsset'
>;

/**
 * 新题按权重阶梯排第一次复习，对齐目标学习日早晨，不再落入今天：
 * 权重 0~2 → 1 天后，3~4 → 2~3 天，5~6 → 5~7 天，7~8 → 10~14 天，9~10 → 21~30 天。
 */
export async function createProblem(input: ProblemInput, now = Date.now()): Promise<string> {
  const id = newId();
  const weight = input.weight ?? weightFromMastery(input.mastery);
  const problem: Problem = { ...input, weight, id, createdAt: now, updatedAt: now };
  const due = calcInitialDue(weight, now);
  await db.transaction('rw', db.problems, db.cards, db.topics, async () => {
    await db.problems.add(problem);
    await db.cards.add({ ...newCard(now, id), due });
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

/**
 * 章节加练：把该章节里「还没到期」的题提前拉到今天，最多 limit 道。
 * 优先挑记忆最弱的（stability 最小），不影响 FSRS 参数。
 */
export async function practiceChapter(chapterId: string, limit = 5): Promise<number> {
  const now = Date.now();
  const end = learningDayEnd(now);
  const problems = await db.problems.where('chapterId').equals(chapterId).toArray();
  const active = problems.filter((p) => !p.archivedAt);
  if (active.length === 0) return 0;

  const cards = await db.cards.bulkGet(active.map((p) => p.id));
  const candidates: { id: string; stability: number }[] = [];
  active.forEach((p, i) => {
    const card = cards[i];
    if (!card) return;
    if (card.due <= end) return; // 今天已经在队列里了
    candidates.push({ id: p.id, stability: card.stability });
  });

  candidates.sort((a, b) => a.stability - b.stability);
  const picked = candidates.slice(0, limit);
  if (picked.length === 0) return 0;

  await db.transaction('rw', db.cards, async () => {
    for (const c of picked) {
      await db.cards.update(c.id, { due: now });
    }
  });
  return picked.length;
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

/**
 * 手动调权重（0~10）：
 * 1. 更新题目本身权重；
 * 2. 若卡片尚处于未复习的新题态（state === 0 且 reps === 0），联动重新对齐到目标权重的初次复习日期。
 */
export async function setWeight(id: string, weight: number): Promise<void> {
  const w = clampWeight(weight);
  const now = Date.now();
  await db.transaction('rw', [db.problems, db.cards], async () => {
    await db.problems.update(id, { weight: w, updatedAt: now });
    const card = await db.cards.get(id);
    if (card && card.state === 0 && (!card.lastReview || card.reps === 0)) {
      const due = calcInitialDue(w, now);
      await db.cards.update(id, {
        due,
        scheduledDays: Math.max(1, Math.round((due - now) / 86400000)),
      });
    }
  });
}
