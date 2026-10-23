import { db, getSetting } from '../../storage/db';
import type { MetaValue } from './MetadataFields';

/** 递增题号字符串中的数字，如 "第3题" -> "第4题"，"5" -> "6" */
export function incrementNo(no?: string): string | undefined {
  if (!no) return undefined;
  const match = no.match(/\d+/);
  if (!match) return no;
  const num = parseInt(match[0], 10);
  return no.replace(match[0], String(num + 1));
}

/** 新建错题时的默认元信息：沿用上次的科目与章节，支持继承当前会话的试卷属性 */
export async function defaultMeta(preset?: Partial<MetaValue>): Promise<MetaValue> {
  const lastSubjectId = preset?.subjectId || (await getSetting<string>('lastSubjectId', ''));
  const lastChapterId = preset?.chapterId || (await getSetting<string>('lastChapterId', ''));
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
    sourceYear: preset?.sourceYear,
    sourcePaper: preset?.sourcePaper,
    sourceNo: preset?.sourceNo,
    sourceKind: preset?.sourceKind,
  };
}
