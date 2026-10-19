import { db } from './db';

export interface IntegrityReport {
  checkedAt: number;
  problems: number;
  assets: number;
  /** 题干图片丢失的题目数 */
  missingStem: number;
  /** 答案图片丢失的引用数（一道题可能多张） */
  missingAnswer: number;
  /** 没有任何题目引用的图片数 */
  orphanAssets: number;
  /** 找不到对应题目的复习卡/日志 */
  orphanCards: number;
  orphanLogs: number;
  /** 指向已删除题目的笔迹 */
  brokenInk: number;
  ok: boolean;
}

/**
 * 只读自检：不算哈希，只核对「引用是否都能落地」。
 * 目的是在数据被浏览器部分清理、或跨设备导入不完整时尽早发现。
 */
export async function checkIntegrity(): Promise<IntegrityReport> {
  const [problems, assets, cards, logs, inks] = await Promise.all([
    db.problems.toArray(),
    db.assets.toArray(),
    db.cards.toArray(),
    db.reviewLogs.toArray(),
    db.inks.toArray(),
  ]);

  const assetIds = new Set(assets.map((a) => a.id));
  const problemIds = new Set(problems.map((p) => p.id));
  const usedAssets = new Set<string>();

  let missingStem = 0;
  let missingAnswer = 0;
  for (const p of problems) {
    usedAssets.add(p.stemAssetId);
    if (!assetIds.has(p.stemAssetId)) missingStem++;
    for (const id of p.answerAssetIds) {
      usedAssets.add(id);
      if (!assetIds.has(id)) missingAnswer++;
    }
    if (p.thumbAssetId) usedAssets.add(p.thumbAssetId);
  }

  const orphanAssets = assets.filter((a) => !usedAssets.has(a.id)).length;
  const orphanCards = cards.filter((c) => !problemIds.has(c.problemId)).length;
  const orphanLogs = logs.filter((l) => !problemIds.has(l.problemId)).length;
  const brokenInk = inks.filter(
    (i) => (i.ownerType === 'attempt' || i.ownerType.startsWith('problem')) && !problemIds.has(i.ownerId)
  ).length;

  return {
    checkedAt: Date.now(),
    problems: problems.length,
    assets: assets.length,
    missingStem,
    missingAnswer,
    orphanAssets,
    orphanCards,
    orphanLogs,
    brokenInk,
    ok: missingStem === 0 && missingAnswer === 0 && orphanCards === 0 && brokenInk === 0,
  };
}

/** 把缺图的题目打上标记，界面会显示「图片缺失」而不是空白 */
export async function flagMissingAssets(): Promise<number> {
  const [problems, assets] = await Promise.all([db.problems.toArray(), db.assets.toArray()]);
  const assetIds = new Set(assets.map((a) => a.id));
  let changed = 0;
  for (const p of problems) {
    const missing = !assetIds.has(p.stemAssetId);
    const next = missing ? 1 : undefined;
    if ((p.missingAsset ?? 0) !== (next ?? 0)) {
      await db.problems.update(p.id, { missingAsset: next as 0 | 1 | undefined });
      changed++;
    }
  }
  return changed;
}
