import { db } from './db';
import { SEED_SUBJECTS } from '../domain/taxonomy';

/** 幂等：仅在 Settings 无 seeded 标记时写入 4 科 36 章节 */
export async function ensureSeeded(): Promise<void> {
  const already = await db.settings.get('seeded');
  if (already) return;

  await db.transaction('rw', db.subjects, db.chapters, db.settings, async () => {
    for (let i = 0; i < SEED_SUBJECTS.length; i++) {
      const s = SEED_SUBJECTS[i];
      const subjectId = crypto.randomUUID();
      await db.subjects.add({
        id: subjectId,
        name: s.name,
        color: s.color,
        order: i,
        archived: 0,
      });
      for (let j = 0; j < s.chapters.length; j++) {
        await db.chapters.add({
          id: crypto.randomUUID(),
          subjectId,
          name: s.chapters[j],
          order: j,
        });
      }
    }
    await db.settings.put({ key: 'seeded', value: true });
  });
}
