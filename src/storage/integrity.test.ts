import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { checkIntegrity, flagMissingAssets } from './integrity';
import { ensureSeeded } from './seed';

const bytes = (s: string) => new TextEncoder().encode(s).buffer;

async function addProblem(id: string, stemAssetId: string, answerAssetIds: string[] = []) {
  await db.problems.add({
    id,
    subjectId: 'sub-1',
    chapterId: 'chap-1-1',
    topicIds: [],
    stemAssetId,
    answerAssetIds,
    wrongNote: '',
    difficulty: 3,
    createdAt: 1,
    updatedAt: 1,
  });
}

async function addAsset(id: string) {
  const data = bytes('img');
  await db.assets.add({
    id,
    kind: 'stem',
    data,
    width: 1,
    height: 1,
    mime: 'image/jpeg',
    bytes: data.byteLength,
    createdAt: 1,
  });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('数据自检', () => {
  it('引用完整时 ok 为真', async () => {
    await addAsset('a1');
    await addProblem('p1', 'a1', ['a1']);
    const r = await checkIntegrity();
    expect(r.ok).toBe(true);
    expect(r.missingStem).toBe(0);
    expect(r.orphanAssets).toBe(0);
  });

  it('题干图丢失会被统计', async () => {
    await addProblem('p1', 'gone');
    const r = await checkIntegrity();
    expect(r.ok).toBe(false);
    expect(r.missingStem).toBe(1);
  });

  it('答案图丢失与无引用图片都能识别', async () => {
    await addAsset('a1');
    await addAsset('spare');
    await addProblem('p1', 'a1', ['gone']);
    const r = await checkIntegrity();
    expect(r.missingAnswer).toBe(1);
    expect(r.orphanAssets).toBe(1);
  });

  it('缺图题目可以被标记', async () => {
    await addProblem('p1', 'gone');
    expect(await flagMissingAssets()).toBe(1);
    expect((await db.problems.get('p1'))?.missingAsset).toBe(1);
    expect(await flagMissingAssets()).toBe(0);
  });
});
