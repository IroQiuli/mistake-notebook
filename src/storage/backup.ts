import JSZip from 'jszip';
import { db, setSetting } from './db';
import type {
  Asset,
  Card,
  Chapter,
  Ink,
  Problem,
  ReviewLog,
  Scratch,
  Setting,
  Subject,
  Topic,
} from '../domain/types';

const FORMAT = 1;
export const APP_VERSION = '0.1.0';

interface BackupData {
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  problems: Problem[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  inks: Ink[];
  scratch: Scratch[];
  settings: Setting[];
  assets: AssetMeta[];
}

export interface BackupManifest {
  format: number;
  appVersion: string;
  exportedAt: number;
  counts: Record<string, number>;
}

type AssetMeta = Omit<Asset, 'data'>;

export async function exportBackup(): Promise<Blob> {
  const [subjects, chapters, topics, problems, cards, reviewLogs, assets, inks, scratch, settings] =
    await Promise.all([
      db.subjects.toArray(),
      db.chapters.toArray(),
      db.topics.toArray(),
      db.problems.toArray(),
      db.cards.toArray(),
      db.reviewLogs.toArray(),
      db.assets.toArray(),
      db.inks.toArray(),
      db.scratch.toArray(),
      db.settings.toArray(),
    ]);

  const assetMetas: AssetMeta[] = assets.map(({ data: _data, ...meta }) => meta);

  const data: BackupData = {
    subjects,
    chapters,
    topics,
    problems,
    cards,
    reviewLogs,
    inks,
    scratch,
    settings,
    assets: assetMetas,
  };

  const manifest: BackupManifest = {
    format: FORMAT,
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
    counts: {
      subjects: subjects.length,
      chapters: chapters.length,
      topics: topics.length,
      problems: problems.length,
      cards: cards.length,
      reviewLogs: reviewLogs.length,
      assets: assets.length,
      inks: inks.length,
    },
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', JSON.stringify(data));
  const folder = zip.folder('assets')!;
  for (const a of assets) {
    folder.file(`${a.id}.bin`, a.data);
  }
  zip.file(
    'README.txt',
    [
      '错题簿备份包',
      `导出时间：${new Date(manifest.exportedAt).toLocaleString('zh-CN')}`,
      `题目数：${problems.length}，图片数：${assets.length}`,
      '',
      '恢复方法：打开错题簿 →「我的 / 设置」→「导入备份」→ 选择本文件。',
      '导入按 id 合并：同 id 以备份内容为准，不会删除设备上已有的其他题目。',
      '请另存到网盘，避免浏览器清理站点数据导致丢失。',
    ].join('\r\n')
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  await setSetting('lastBackupAt', Date.now());
  return blob;
}

export interface ImportResult {
  problems: number;
  assets: number;
  missingAssets: number;
}

export async function importBackup(file: Blob): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  const dataFile = zip.file('data.json');
  if (!manifestFile || !dataFile) throw new Error('备份包不完整：缺少 manifest.json 或 data.json');

  const manifest = JSON.parse(await manifestFile.async('string')) as BackupManifest;
  if (manifest.format !== FORMAT) {
    throw new Error(`备份格式版本 ${manifest.format} 与当前版本 ${FORMAT} 不兼容`);
  }

  const data = JSON.parse(await dataFile.async('string')) as BackupData;

  const assets: Asset[] = [];
  let missingAssets = 0;
  for (const meta of data.assets ?? []) {
    const entry = zip.file(`assets/${meta.id}.bin`);
    if (!entry) {
      missingAssets++;
      continue;
    }
    const buffer = await entry.async('arraybuffer');
    assets.push({ ...meta, data: buffer });
  }

  const available = new Set(assets.map((a) => a.id));
  const problems = data.problems.map((p) =>
    available.has(p.stemAssetId) ? { ...p, missingAsset: undefined } : { ...p, missingAsset: 1 as const }
  );
  const problemIds = new Set(problems.map((p) => p.id));

  await db.transaction(
    'rw',
    [
      db.subjects,
      db.chapters,
      db.topics,
      db.problems,
      db.cards,
      db.reviewLogs,
      db.assets,
      db.inks,
      db.scratch,
      db.settings,
    ],
    async () => {
      await db.subjects.bulkPut(data.subjects);
      await db.chapters.bulkPut(data.chapters);
      await db.topics.bulkPut(data.topics ?? []);
      await db.problems.bulkPut(problems);
      await db.cards.bulkPut(data.cards.filter((c) => problemIds.has(c.problemId)));
      await db.reviewLogs.bulkPut(data.reviewLogs.filter((r) => problemIds.has(r.problemId)));
      await db.assets.bulkPut(assets);
      await db.inks.bulkPut(data.inks ?? []);
      await db.scratch.bulkPut(data.scratch ?? []);
      await db.settings.bulkPut(
        data.settings.filter((s) => s.key !== 'seeded' && s.key !== 'lastSession')
      );
      await db.settings.put({ key: 'seeded', value: true });
    }
  );

  return { problems: problems.length, assets: assets.length, missingAssets };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(now = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cuotiben-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.zip`;
}
