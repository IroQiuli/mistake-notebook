import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { exportBackup, importBackup } from './backup';
import { ensureSeeded } from './seed';

const bytes = (s: string) => new TextEncoder().encode(s).buffer;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

async function addProblemWithImage() {
  const data = bytes('fake-image-bytes');
  await db.assets.add({
    id: 'a1',
    kind: 'stem',
    data,
    width: 10,
    height: 10,
    mime: 'image/jpeg',
    bytes: data.byteLength,
    createdAt: 1,
  });
  await db.problems.add({
    id: 'p1',
    subjectId: 's',
    chapterId: 'c',
    topicIds: [],
    stemAssetId: 'a1',
    answerAssetIds: [],
    wrongNote: 'x',
    difficulty: 3,
    createdAt: 1,
    updatedAt: 1,
  });
  await db.cards.add({
    problemId: 'p1',
    due: 1,
    stability: 1,
    difficulty: 1,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    learningSteps: 0,
  });
}

describe('备份回路', () => {
  it('导出再导入后数据一致', async () => {
    await addProblemWithImage();
    const zip = await exportBackup();
    expect(zip.size).toBeGreaterThan(0);

    await db.delete();
    await db.open();
    await ensureSeeded();

    const result = await importBackup(zip);
    expect(result.problems).toBe(1);
    expect(result.assets).toBe(1);
    expect(result.missingAssets).toBe(0);
    expect(await db.problems.count()).toBe(1);
    expect(await db.assets.count()).toBe(1);
    expect(await db.subjects.count()).toBe(4);

    const asset = await db.assets.get('a1');
    expect(new TextDecoder().decode(asset!.data)).toBe('fake-image-bytes');
    expect((await db.problems.get('p1'))!.missingAsset).toBeUndefined();
  });

  it('导入时同 id 以备份内容为准，不重复插入', async () => {
    await addProblemWithImage();
    const zip = await exportBackup();
    await db.problems.update('p1', { wrongNote: '本地改过' });
    await importBackup(zip);
    expect((await db.problems.get('p1'))!.wrongNote).toBe('x');
    expect(await db.problems.count()).toBe(1);
  });

  it('缺图的题目被标记 missingAsset', async () => {
    await db.problems.add({
      id: 'p2',
      subjectId: 's',
      chapterId: 'c',
      topicIds: [],
      stemAssetId: 'not-exist',
      answerAssetIds: [],
      wrongNote: '',
      difficulty: 3,
      createdAt: 1,
      updatedAt: 1,
    });
    const zip = await exportBackup();
    await db.problems.delete('p2');
    const result = await importBackup(zip);
    expect(result.missingAssets).toBe(0);
    expect((await db.problems.get('p2'))!.missingAsset).toBe(1);
  });
});
