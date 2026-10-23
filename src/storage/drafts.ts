import { db } from './db';
import { newId } from '../lib/id';
import type { CaptureDraft } from '../domain/types';

export async function addDraft(blob: Blob): Promise<string> {
  const id = newId();
  await db.drafts.add({ id, blob, createdAt: Date.now() });
  return id;
}

export async function addDrafts(blobs: Blob[]): Promise<string[]> {
  const now = Date.now();
  const items = blobs.map((blob, i) => ({
    id: newId(),
    blob,
    createdAt: now + i,
  }));
  await db.drafts.bulkAdd(items);
  return items.map((it) => it.id);
}

export async function deleteDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}

export async function clearAllDrafts(): Promise<void> {
  await db.drafts.clear();
}

export async function getDrafts(): Promise<CaptureDraft[]> {
  return db.drafts.orderBy('createdAt').toArray();
}
