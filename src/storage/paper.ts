import { getSetting, setSetting } from './db';
import { newId } from '../lib/id';

/** 正在做的一张套卷：只存题目顺序，题目本身仍在 problems 表里 */
export interface ActivePaper {
  id: string;
  title: string;
  createdAt: number;
  problemIds: string[];
}

const KEY = 'activePaper';

export async function saveActivePaper(
  paper: Omit<ActivePaper, 'id' | 'createdAt'> & Partial<Pick<ActivePaper, 'id' | 'createdAt'>>
): Promise<ActivePaper> {
  const full: ActivePaper = {
    id: paper.id ?? newId(),
    title: paper.title,
    createdAt: paper.createdAt ?? Date.now(),
    problemIds: paper.problemIds,
  };
  await setSetting(KEY, full);
  return full;
}

export async function loadActivePaper(): Promise<ActivePaper | null> {
  const raw = await getSetting<ActivePaper | null>(KEY, null);
  if (!raw || !Array.isArray(raw.problemIds) || raw.problemIds.length === 0) return null;
  return raw;
}

export async function clearActivePaper(): Promise<void> {
  await setSetting(KEY, null);
}
