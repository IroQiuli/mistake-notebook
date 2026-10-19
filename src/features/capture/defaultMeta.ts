import { db, getSetting } from '../../storage/db';
import type { MetaValue } from './MetadataFields';

/** 新建错题时的默认元信息：沿用上次的科目与章节 */
export async function defaultMeta(): Promise<MetaValue> {
  const lastSubjectId = await getSetting<string>('lastSubjectId', '');
  const lastChapterId = await getSetting<string>('lastChapterId', '');
  const subjects = await db.subjects.orderBy('order').toArray();
  const subjectId = subjects.some((s) => s.id === lastSubjectId)
    ? lastSubjectId
    : (subjects[0]?.id ?? '');

  const chapters = await db.chapters.where('subjectId').equals(subjectId).sortBy('order');
  const chapterId = chapters.some((c) => c.id === lastChapterId)
    ? lastChapterId
    : (chapters[0]?.id ?? '');

  return {
    subjectId,
    chapterId,
    topicIds: [],
    difficulty: 3,
    wrongNote: '',
    errorTags: [],
  };
}
