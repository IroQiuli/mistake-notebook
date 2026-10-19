import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { ensureSeeded } from './seed';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('首次启动种子', () => {
  it('写入 4 个科目与 36 个章节', async () => {
    await ensureSeeded();
    expect(await db.subjects.count()).toBe(4);
    expect(await db.chapters.count()).toBe(36);
  });

  it('重复调用不产生重复数据', async () => {
    await ensureSeeded();
    await ensureSeeded();
    expect(await db.subjects.count()).toBe(4);
    expect(await db.chapters.count()).toBe(36);
  });

  it('数学二包含 12 个章节且覆盖线代', async () => {
    await ensureSeeded();
    const math = (await db.subjects.toArray()).find((s) => s.name === '数学二')!;
    const names = (await db.chapters.where('subjectId').equals(math.id).toArray()).map((c) => c.name);
    expect(names).toHaveLength(12);
    expect(names).toContain('一元函数微分学');
    expect(names).toContain('二次型');
  });
});
