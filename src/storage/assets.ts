import { db } from './db';
import { newId } from '../lib/id';
import type { Asset, AssetKind } from '../domain/types';

const urlCache = new Map<string, string>();

export function blobToBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsArrayBuffer(blob);
  });
}

export function assetToBlob(asset: Pick<Asset, 'data' | 'mime'>): Blob {
  return new Blob([asset.data], { type: asset.mime });
}

export async function putAsset(
  blob: Blob,
  kind: AssetKind,
  size: { width: number; height: number },
  sourceAssetId?: string
): Promise<string> {
  const id = newId();
  const data = await blobToBuffer(blob);
  await db.assets.add({
    id,
    kind,
    sourceAssetId,
    data,
    width: size.width,
    height: size.height,
    mime: blob.type || 'image/jpeg',
    bytes: data.byteLength,
    createdAt: Date.now(),
  });
  return id;
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return db.assets.get(id);
}

export async function getUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const asset = await db.assets.get(id);
  if (!asset) return null;
  const url = URL.createObjectURL(assetToBlob(asset));
  urlCache.set(id, url);
  return url;
}

export function releaseUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export async function deleteAssets(ids: string[]): Promise<void> {
  ids.forEach(releaseUrl);
  await db.assets.bulkDelete(ids);
}

/** 删除没有任何错题引用的图片，返回释放的字节数 */
export async function collectOrphans(): Promise<number> {
  const problems = await db.problems.toArray();
  const used = new Set<string>();
  for (const p of problems) {
    used.add(p.stemAssetId);
    p.answerAssetIds.forEach((a) => used.add(a));
  }
  const all = await db.assets.toArray();
  const orphans = all.filter((a) => !used.has(a.id));
  const bytes = orphans.reduce((sum, a) => sum + a.bytes, 0);
  await deleteAssets(orphans.map((a) => a.id));
  return bytes;
}

export async function storageUsage(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
