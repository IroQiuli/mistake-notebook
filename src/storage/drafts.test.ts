import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { addDraft, addDrafts, deleteDraft, clearAllDrafts, getDrafts } from './drafts';
import { incrementNo } from '../features/capture/defaultMeta';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('DraftInbox & drafts storage', () => {
  it('可以添加、查询和删除草稿', async () => {
    const blob1 = new Blob(['img1'], { type: 'image/jpeg' });
    const id1 = await addDraft(blob1);
    expect(id1).toBeTruthy();

    let drafts = await getDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(id1);

    await deleteDraft(id1);
    drafts = await getDrafts();
    expect(drafts).toHaveLength(0);
  });

  it('支持批量添加草稿与一键清空', async () => {
    const b1 = new Blob(['1'], { type: 'image/jpeg' });
    const b2 = new Blob(['2'], { type: 'image/jpeg' });
    const ids = await addDrafts([b1, b2]);
    expect(ids).toHaveLength(2);

    let drafts = await getDrafts();
    expect(drafts).toHaveLength(2);

    await clearAllDrafts();
    drafts = await getDrafts();
    expect(drafts).toHaveLength(0);
  });
});

describe('incrementNo (题号自增)', () => {
  it('正确自增题号中的数字', () => {
    expect(incrementNo('1')).toBe('2');
    expect(incrementNo('第3题')).toBe('第4题');
    expect(incrementNo('15')).toBe('16');
    expect(incrementNo('Q9')).toBe('Q10');
    expect(incrementNo('选择题')).toBe('选择题');
    expect(incrementNo(undefined)).toBeUndefined();
  });
});
