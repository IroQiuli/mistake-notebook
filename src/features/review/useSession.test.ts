import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSession } from './useSession';
import { db } from '../../storage/db';
import { newCard } from '../../domain/scheduler';
import type { Problem } from '../../domain/types';

const T0 = Date.now();

const createTestProblem = (id: string): Problem => ({
  id,
  subjectId: 's1',
  chapterId: 'c1',
  topicIds: [],
  stemAssetId: 'stem1',
  answerAssetIds: [],
  wrongNote: '',
  difficulty: 3,
  createdAt: T0,
  updatedAt: T0,
});

beforeEach(async () => {
  await db.problems.clear();
  await db.cards.clear();
  await db.reviewLogs.clear();
  await db.settings.clear();
});

describe('useSession 会话状态与实时移除机制', () => {
  it('点击评分按钮后，该题立即从当前 queue 移除，无需退出复习页', async () => {
    const p1 = createTestProblem('p1');
    const p2 = createTestProblem('p2');
    const c1 = { ...newCard(T0 - 86400000, 'p1'), due: T0 - 86400000 };
    const c2 = { ...newCard(T0 - 86400000, 'p2'), due: T0 - 86400000 };

    await db.problems.bulkAdd([p1, p2]);
    await db.cards.bulkAdd([c1, c2]);

    const { result } = renderHook(() => useSession('s1'));

    await waitFor(() => {
      expect(result.current.queue).not.toBeNull();
      expect(result.current.queue?.length).toBe(2);
    });

    expect(result.current.current?.problem.id).toBe('p1');
    expect(result.current.finished).toBe(false);

    // 评第 1 题为 3（良好）
    await act(async () => {
      await result.current.rate(3);
    });

    // p1 应立即被从当前界面 queue 中移除，当前题目切换至 p2，且 queue 长度为 1
    expect(result.current.queue?.length).toBe(1);
    expect(result.current.queue?.map((x) => x.problem.id)).toEqual(['p2']);
    expect(result.current.current?.problem.id).toBe('p2');
    expect(result.current.index).toBe(0);
    expect(result.current.finished).toBe(false);

    // 评第 2 题为 4（简单）
    await act(async () => {
      await result.current.rate(4);
    });

    // 全部做完后 queue 为空，finished 为 true
    expect(result.current.queue?.length).toBe(0);
    expect(result.current.finished).toBe(true);
    expect(result.current.stats.length).toBe(2);
  });
});
