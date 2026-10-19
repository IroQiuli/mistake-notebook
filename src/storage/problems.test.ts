import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { createProblem, deleteProblem, markArchived, type ProblemInput } from './problems';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.subjects.add({ id: 's1', name: '数学二', color: '#000', order: 0, archived: 0 });
  await db.chapters.add({ id: 'c1', subjectId: 's1', name: '矩阵', order: 0 });
});

const input = (): ProblemInput => ({
  subjectId: 's1',
  chapterId: 'c1',
  topicIds: [],
  stemAssetId: 'a1',
  answerAssetIds: [],
  wrongNote: '秩算错',
  difficulty: 3,
});

describe('createProblem', () => {
  it('同时写入题目与卡片，due 为当前时间', async () => {
    const now = Date.now();
    const id = await createProblem(input(), now);
    const p = await db.problems.get(id);
    const c = await db.cards.get(id);
    expect(p).toBeTruthy();
    expect(c!.due).toBe(now);
    expect(c!.state).toBe(0);
  });

  it('删除题目级联删除卡片与日志', async () => {
    const id = await createProblem(input(), Date.now());
    await db.reviewLogs.add({
      id: 'r1',
      problemId: id,
      rating: 3,
      reviewedAt: Date.now(),
      durationMs: 1000,
      prevDue: 0,
      nextDue: 0,
      prevState: 0,
      nextState: 2,
    });
    await deleteProblem(id);
    expect(await db.problems.get(id)).toBeUndefined();
    expect(await db.cards.get(id)).toBeUndefined();
    expect(await db.reviewLogs.where('problemId').equals(id).count()).toBe(0);
  });

  it('归档后卡片保留但问题带 archivedAt', async () => {
    const id = await createProblem(input(), Date.now());
    await markArchived(id, true);
    const p = await db.problems.get(id);
    expect(p!.archivedAt).toBeGreaterThan(0);
    expect(await db.cards.get(id)).toBeTruthy();
  });
});
