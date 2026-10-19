import type { Card, Chapter, Problem, Subject } from './types';
import { isRealExam } from './filter';
import { retrievability } from './scheduler';

/**
 * 套卷：把错题按「考研卷子的结构」或「快忘光的顺序」重新排成一张有顺序的卷子。
 * 这里只负责挑题和排序，不落库；是否保存成一张「进行中的卷子」由 storage 层决定。
 */

export type PaperMode = 'category' | 'forgetting';

export interface PaperRequest {
  mode: PaperMode;
  /** 每个科目抽几道；缺省时按 available 比例分 total */
  perSubject?: Record<string, number>;
  total?: number;
  subjectIds?: string[];
  chapterIds?: string[];
  /** 只看真题 */
  realOnly?: boolean;
  years?: number[];
}

export interface PaperPick {
  problem: Problem;
  chapterName: string;
  subjectId: string;
  /** 预设卷里的题号，如「第3题」 */
  slot?: string;
}

export interface PaperSubjectStat {
  subjectId: string;
  requested: number;
  picked: number;
  available: number;
}

export interface PaperPlan {
  mode: PaperMode;
  items: PaperPick[];
  perSubject: PaperSubjectStat[];
  /** 想抽但没那么多题 */
  shortage: number;
}

export interface PaperSlot {
  label: string;
  chapters: string[];
  count: number;
}

export interface PaperPreset {
  /** 用于展示，如「数学二 22 题」 */
  label: string;
  total: number;
  /** 有槽位时按题号逐题抽，保证「一题一章」 */
  slots?: PaperSlot[];
}

/**
 * 卷型来自历年真题：
 * - 数学二：10 选择 + 6 填空 + 6 解答 = 22 题
 * - 839 自控：8 道综合大题，第 1~6 题是自控（建模/时域/根轨迹/频域校正/非线性/离散），
 *   第 7~8 题是过程控制（检测仪表与机理建模 / 复杂控制方案设计）
 * - 英语二 48 题、政治 38 题（先给默认值，之后可改）
 */
export const PAPER_PRESETS: { match: RegExp; preset: PaperPreset }[] = [
  {
    match: /数学/,
    preset: { label: '数学二 22 题（10 选 + 6 填 + 6 解）', total: 22 },
  },
  {
    match: /839|自控/,
    preset: {
      label: '八道大题 · 一题一章',
      total: 8,
      slots: [
        { label: '第 1 题', chapters: ['控制系统的数学模型'], count: 1 },
        { label: '第 2 题', chapters: ['线性系统的时域分析法'], count: 1 },
        { label: '第 3 题', chapters: ['根轨迹分析法'], count: 1 },
        { label: '第 4 题', chapters: ['线性系统的频域分析法', '线性系统的校正方法'], count: 1 },
        { label: '第 5 题', chapters: ['非线性控制系统分析'], count: 1 },
        { label: '第 6 题', chapters: ['线性离散控制系统'], count: 1 },
        { label: '第 7 题', chapters: ['过程检测及控制仪表', '被控过程特性的机理建模'], count: 1 },
        {
          label: '第 8 题',
          chapters: [
            '复杂过程控制系统方案设计',
            '常规过程控制系统（单回路控制）',
            '典型工业过程控制综合设计实战',
          ],
          count: 1,
        },
      ],
    },
  },
  { match: /英语/, preset: { label: '英语二 48 题', total: 48 } },
  { match: /政治/, preset: { label: '政治 38 题', total: 38 } },
];

export function paperPresetFor(subjectName: string): PaperPreset | undefined {
  return PAPER_PRESETS.find((p) => p.match.test(subjectName))?.preset;
}

/** 把 total 按各科现有题量比例分配，保证有题的科目至少 1 道 */
export function allocate(available: Record<string, number>, total: number): Record<string, number> {
  const ids = Object.keys(available).filter((id) => available[id] > 0);
  const sum = ids.reduce((s, id) => s + available[id], 0);
  const out: Record<string, number> = {};
  if (!ids.length || total <= 0) {
    for (const id of Object.keys(available)) out[id] = 0;
    return out;
  }

  let assigned = 0;
  const remainders: { id: string; rest: number }[] = [];
  for (const id of ids) {
    const exact = (available[id] / sum) * total;
    const base = Math.max(1, Math.floor(exact));
    out[id] = Math.min(base, available[id]);
    assigned += out[id];
    remainders.push({ id, rest: exact - Math.floor(exact) });
  }

  // 每科至少 1 道可能超出总量，从「超出自己份额最多」的科目里减回去
  const excess = assigned - total;
  if (excess > 0) {
    const byOver = ids
      .map((id) => ({ id, over: out[id] - (available[id] / sum) * total }))
      .sort((a, b) => b.over - a.over);
    let left = excess;
    for (const { id } of byOver) {
      while (left > 0 && out[id] > 1) {
        out[id]--;
        left--;
      }
      if (left <= 0) break;
    }
    assigned -= excess - left;
  }

  // 用最大余数补差额
  remainders.sort((a, b) => b.rest - a.rest);
  let i = 0;
  while (assigned < total && i < remainders.length * 4) {
    const { id } = remainders[i % remainders.length];
    if (out[id] < available[id]) {
      out[id]++;
      assigned++;
    }
    i++;
  }

  for (const id of Object.keys(available)) if (!(id in out)) out[id] = 0;
  return out;
}

function matches(p: Problem, req: PaperRequest): boolean {
  if (p.archivedAt) return false;
  if (req.subjectIds?.length && !req.subjectIds.includes(p.subjectId)) return false;
  if (req.chapterIds?.length && !req.chapterIds.includes(p.chapterId)) return false;
  if (req.realOnly && !isRealExam(p)) return false;
  if (req.years?.length && (!p.sourceYear || !req.years.includes(p.sourceYear))) return false;
  return true;
}

function chapterIndexMap(chapters: Chapter[]): Map<string, number> {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  return new Map(sorted.map((c, i) => [c.id, i]));
}

/**
 * 按章节轮转抽题：先把章节按顺序排好，一章一道地轮，
 * 每章内部按「记忆最弱」优先，这样一张卷子会覆盖尽可能多的章节。
 */
function spreadByChapter(pool: Problem[], cards: Map<string, Card>, chapters: Chapter[], count: number) {
  const order = chapterIndexMap(chapters);
  const byChapter = new Map<string, Problem[]>();
  for (const p of pool) {
    const arr = byChapter.get(p.chapterId) ?? [];
    arr.push(p);
    byChapter.set(p.chapterId, arr);
  }
  for (const arr of byChapter.values()) {
    arr.sort((a, b) => {
      const sa = cards.get(a.id)?.stability ?? 0;
      const sb = cards.get(b.id)?.stability ?? 0;
      return sa - sb || b.createdAt - a.createdAt;
    });
  }

  const chapterOrder = [...byChapter.keys()].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  );

  const picked: Problem[] = [];
  let added = true;
  while (picked.length < count && added) {
    added = false;
    for (const cid of chapterOrder) {
      if (picked.length >= count) break;
      const next = byChapter.get(cid)!.shift();
      if (next) {
        picked.push(next);
        added = true;
      }
    }
  }
  return picked;
}

export function buildPaper(
  problems: Problem[],
  cards: Card[],
  chapters: Chapter[],
  req: PaperRequest,
  now: number
): PaperPlan {
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));
  const chapterMap = new Map(chapters.map((c) => [c.id, c.name]));
  const candidates = problems.filter((p) => matches(p, req));

  const bySubject = new Map<string, Problem[]>();
  for (const p of candidates) {
    const arr = bySubject.get(p.subjectId) ?? [];
    arr.push(p);
    bySubject.set(p.subjectId, arr);
  }

  const available: Record<string, number> = {};
  for (const [sid, list] of bySubject) available[sid] = list.length;

  const requested: Record<string, number> = req.perSubject
    ? { ...req.perSubject }
    : allocate(available, req.total ?? 20);

  const items: PaperPick[] = [];
  const perSubject: PaperSubjectStat[] = [];
  let shortage = 0;

  for (const sid of Object.keys(requested)) {
    const want = Math.max(0, requested[sid] ?? 0);
    const pool = bySubject.get(sid) ?? [];
    if (want === 0) {
      perSubject.push({ subjectId: sid, requested: 0, picked: 0, available: pool.length });
      continue;
    }

    let picked: Problem[] = [];
    if (req.mode === 'forgetting') {
      picked = [...pool]
        .sort(
          (a, b) =>
            retrievability(cardMap.get(a.id)!, now) - retrievability(cardMap.get(b.id)!, now) ||
            (cardMap.get(a.id)?.due ?? 0) - (cardMap.get(b.id)?.due ?? 0)
        )
        .slice(0, want);
    } else {
      picked = spreadByChapter(pool, cardMap, chapters, want);
    }

    for (const p of picked) {
      items.push({
        problem: p,
        subjectId: sid,
        chapterName: chapterMap.get(p.chapterId) ?? '未分类',
      });
    }
    perSubject.push({
      subjectId: sid,
      requested: want,
      picked: picked.length,
      available: pool.length,
    });
    shortage += Math.max(0, want - picked.length);
  }

  return { mode: req.mode, items, perSubject, shortage };
}

/**
 * 按卷型抽：839 这种「一题一章」的卷子按题号逐个槽位抽，
 * 其它科目退化成「按现有题量均摊」。
 */
export function buildPresetPaper(
  subject: Subject,
  chapters: Chapter[],
  problems: Problem[],
  cards: Card[],
  now: number
): PaperPlan {
  const preset = paperPresetFor(subject.name);
  const mine = chapters.filter((c) => c.subjectId === subject.id);
  const pool = problems.filter((p) => !p.archivedAt && p.subjectId === subject.id);
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));

  if (!preset?.slots) {
    return buildPaper(problems, cards, chapters, { mode: 'category', perSubject: { [subject.id]: preset?.total ?? 20 } }, now);
  }

  const nameToChapter = new Map(mine.map((c) => [c.name, c]));
  const items: PaperPick[] = [];
  let shortage = 0;

  for (const slot of preset.slots) {
    const ids = slot.chapters
      .map((name) => nameToChapter.get(name)?.id)
      .filter((id): id is string => Boolean(id));
    const candidates = pool
      .filter((p) => ids.includes(p.chapterId))
      .sort((a, b) => (cardMap.get(a.id)?.stability ?? 0) - (cardMap.get(b.id)?.stability ?? 0));

    for (let i = 0; i < slot.count; i++) {
      const p = candidates[i];
      if (!p) {
        shortage++;
        continue;
      }
      items.push({
        problem: p,
        subjectId: subject.id,
        chapterName: mine.find((c) => c.id === p.chapterId)?.name ?? '未分类',
        slot: slot.label,
      });
    }
  }

  return {
    mode: 'category',
    items,
    shortage,
    perSubject: [
      {
        subjectId: subject.id,
        requested: preset.total,
        picked: items.length,
        available: pool.length,
      },
    ],
  };
}
