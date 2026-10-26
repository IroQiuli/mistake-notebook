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
export const APP_VERSION = '0.8.0';

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
  includeAssets?: boolean;
  counts: Record<string, number>;
}

type AssetMeta = Omit<Asset, 'data'>;

export interface ExportOptions {
  /** 是否打包图片等大文件二进制（默认为 true，若为 false 则仅导出文本、结构与复习卡片等轻量快照，<100KB） */
  includeAssets?: boolean;
}

export async function exportBackup(options: ExportOptions = {}): Promise<Blob> {
  const includeAssets = options.includeAssets !== false;
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
    includeAssets,
    counts: {
      subjects: subjects.length,
      chapters: chapters.length,
      topics: topics.length,
      problems: problems.length,
      cards: cards.length,
      reviewLogs: reviewLogs.length,
      assets: includeAssets ? assets.length : 0,
      inks: inks.length,
    },
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', JSON.stringify(data));
  if (includeAssets) {
    const folder = zip.folder('assets')!;
    for (const a of assets) {
      folder.file(`${a.id}.bin`, a.data);
    }
  }
  zip.file(
    'README.txt',
    [
      includeAssets ? '错题簿全量备份包（含原图）' : '错题簿轻量数据快照（不含图片，<100KB）',
      `导出时间：${new Date(manifest.exportedAt).toLocaleString('zh-CN')}`,
      `题目数：${problems.length}，图片数：${includeAssets ? assets.length : '不含图片二进制（引用已保留）'}`,
      '',
      '恢复方法：打开错题簿 →「我的 / 设置」→「导入备份」→ 选择本文件。',
      '导入按 id 合并：同 id 以备份内容为准，不会删除设备上已有的其他题目。',
      includeAssets
        ? '全量备份建议存放于网盘（如百度网盘、阿里云盘或 iCloud），避免设备损坏。'
        : '快照包含全套错题笔记、做题记录、用时与 FSRS 排期，秒级生成，可高频备份不占本地存储。',
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

  const existingAssetIds = new Set(await db.assets.toCollection().primaryKeys());
  const assets: Asset[] = [];
  let missingAssets = 0;
  for (const meta of data.assets ?? []) {
    const entry = zip.file(`assets/${meta.id}.bin`);
    if (entry) {
      const buffer = await entry.async('arraybuffer');
      assets.push({ ...meta, data: buffer });
    } else if (!existingAssetIds.has(meta.id)) {
      missingAssets++;
    }
  }

  const available = new Set([...existingAssetIds, ...assets.map((a) => a.id)]);
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
      if (assets.length > 0) {
        await db.assets.bulkPut(assets);
      }
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

export async function saveOrShareBackup(
  blob: Blob,
  filename: string,
  target: 'picker' | 'share' | 'download' = 'picker'
): Promise<'saved' | 'shared' | 'downloaded' | 'cancelled'> {
  if (target === 'share' && typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'application/zip' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: '错题簿备份',
          text: `错题簿备份 (${filename})`,
          files: [file],
        });
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      console.warn('Web Share failed, fallback to download:', err);
    }
  }

  if (target === 'picker' && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = filename.endsWith('.ctbx') ? 'ctbx' : 'zip';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: filename.endsWith('.ctbx') ? '错题簿加密备份包' : '错题簿备份包',
            accept: {
              'application/octet-stream': [`.${ext}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      console.warn('FilePicker failed, fallback to download:', err);
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}

export function backupFilename(
  now = Date.now(),
  encrypted = false,
  options?: { snapshot?: boolean; singleLatest?: boolean }
): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const prefix = options?.snapshot ? 'cuotiben-snapshot' : 'cuotiben-backup';
  const name = options?.singleLatest ? `${prefix}-latest` : `${prefix}-${stamp}`;
  return `${name}.${encrypted ? 'ctbx' : 'zip'}`;
}
