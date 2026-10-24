import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  createProblem,
  createTopic,
  updateTopic,
  deleteTopic,
  deleteProblem,
  markArchived,
  setWeight,
  type ProblemInput,
} from './problems';
import { calcInitialDue } from '../domain/weight';
import { formatDue } from '../domain/time';

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
  it('新题按掌握程度安排第一次复习，不直接塞进今天', async () => {
    const now = Date.now();
    const id = await createProblem({ ...input(), mastery: 2, difficulty: 3 }, now);
    const p = await db.problems.get(id);
    const c = await db.cards.get(id);
    expect(p).toBeTruthy();
    expect(c!.state).toBe(0);
    // 不熟 (mastery 2 -> weight 4) → 3 天后对齐早晨
    expect(c!.due).toBe(calcInitialDue(4, now));
    expect(formatDue(c!.due, now)).toBe('3 天后');
    // 权重跟着掌握程度走（不熟 = 4）
    expect(p!.weight).toBe(4);
  });

  it('完全不会 (mastery 1 -> weight 2) → 1 天后复习', async () => {
    const now = Date.now();
    const id = await createProblem({ ...input(), mastery: 1, difficulty: 5 }, now);
    const c = await db.cards.get(id);
    expect(c!.due).toBe(calcInitialDue(2, now));
    expect(formatDue(c!.due, now)).toBe('明天');
  });

  it('手动调权重后，新题联动更新下次复习日期', async () => {
    const now = Date.now();
    const id = await createProblem({ ...input(), weight: 2 }, now);
    let c = await db.cards.get(id);
    expect(formatDue(c!.due, now)).toBe('明天');

    // 提高权重到 6（一般，7天后）
    await setWeight(id, 6);
    const p = await db.problems.get(id);
    c = await db.cards.get(id);
    expect(p!.weight).toBe(6);
    expect(formatDue(c!.due, now)).toBe('7 天后');
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

  it('录题支持携带答案资产 answerAssetIds', async () => {
    const id = await createProblem(
      { ...input(), answerAssetIds: ['ans_1', 'ans_2'] },
      Date.now()
    );
    const p = await db.problems.get(id);
    expect(p?.answerAssetIds).toEqual(['ans_1', 'ans_2']);
  });

  it('知识点标签支持修改名称及级联删除', async () => {
    const topic = await createTopic('s1', '线性相关性');
    expect(topic.name).toBe('线性相关性');

    // 修改知识点标签
    await updateTopic(topic.id, '线性相关与线性无关');
    const updated = await db.topics.get(topic.id);
    expect(updated?.name).toBe('线性相关与线性无关');

    // 关联题目并删除标签
    const probId = await createProblem(
      { ...input(), topicIds: [topic.id] },
      Date.now()
    );
    let p = await db.problems.get(probId);
    expect(p?.topicIds).toContain(topic.id);

    await deleteTopic(topic.id);
    expect(await db.topics.get(topic.id)).toBeUndefined();

    // 题目的 topicIds 中的引用被自动清理
    p = await db.problems.get(probId);
    expect(p?.topicIds).not.toContain(topic.id);
  });
});
