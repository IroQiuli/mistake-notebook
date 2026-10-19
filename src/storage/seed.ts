import { db } from './db';
import { SEED_SUBJECTS } from '../domain/taxonomy';

/** 幂等：仅在 Settings 无 seeded 标记时写入 4 科 36 章节；用 put 保证并发调用也不冲突 */
export async function ensureSeeded(): Promise<void> {
  const already = await db.settings.get('seeded');
  if (already) return;

  await db.transaction('rw', db.subjects, db.chapters, db.settings, async () => {
    const raced = await db.settings.get('seeded');
    if (raced) return;

    for (let i = 0; i < SEED_SUBJECTS.length; i++) {
      const s = SEED_SUBJECTS[i];
      // 固定 id：备份导入时能按 id 合并，不会因为重新种子产生重复科目
      const subjectId = `sub-${i + 1}`;
      await db.subjects.put({
        id: subjectId,
        name: s.name,
        color: s.color,
        order: i,
        archived: 0,
      });
      for (let j = 0; j < s.chapters.length; j++) {
        await db.chapters.put({
          id: `chap-${i + 1}-${j + 1}`,
          subjectId,
          name: s.chapters[j],
          order: j,
        });
      }
    }
    await db.settings.put({ key: 'seeded', value: true });
  });
}
