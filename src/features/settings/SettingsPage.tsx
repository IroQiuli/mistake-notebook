import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Download, HardDrive, Plus, Upload } from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import {
  backupFilename,
  downloadBlob,
  exportBackup,
  importBackup,
} from '../../storage/backup';
import { collectOrphans, formatBytes, storageUsage } from '../../storage/assets';
import { createChapter } from '../../storage/problems';
import { formatDateTime } from '../../domain/time';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-500">
        {title}
      </h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState('');

  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const problems = useLiveQuery(() => db.problems.count(), [], 0);
  const assets = useLiveQuery(() => db.assets.count(), [], 0);
  const lastBackupAt = useLiveQuery(() => getSetting<number>('lastBackupAt', 0), [], 0);

  const refreshUsage = () => {
    storageUsage().then(setUsage).catch(() => {});
  };

  useEffect(() => {
    refreshUsage();
  }, [problems, assets]);

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await exportBackup();
      downloadBlob(blob, backupFilename());
      toast.show('备份已生成，请保存到网盘', 'success');
      refreshUsage();
    } catch (err) {
      console.error(err);
      toast.show('导出失败：' + (err instanceof Error ? err.message : '未知错误'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      const result = await importBackup(pendingImport);
      toast.show(
        `导入完成：${result.problems} 道题、${result.assets} 张图${
          result.missingAssets ? `，${result.missingAssets} 张缺图` : ''
        }`,
        'success'
      );
      setPendingImport(null);
      refreshUsage();
    } catch (err) {
      console.error(err);
      toast.show('导入失败：' + (err instanceof Error ? err.message : '格式不对'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">我的</h1>
        <p className="mt-0.5 text-xs text-zinc-500">数据、分类与备份</p>
      </header>

      <Section title="数据">
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="text-sm text-zinc-800">
              已存 {problems} 道错题 · {assets} 张图片
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400">
              {usage.quota > 0
                ? `占用 ${formatBytes(usage.usage)} / 可用 ${formatBytes(usage.quota)}`
                : '正在统计占用…'}
            </div>
          </div>
          <HardDrive size={18} className="text-zinc-300" />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
          <span className="text-xs text-zinc-500">
            {lastBackupAt ? `上次备份：${formatDateTime(lastBackupAt)}` : '还没有备份过'}
          </span>
          {lastBackupAt > 0 && (
            <span className="text-[11px] text-zinc-400">
              {Math.floor((Date.now() - lastBackupAt) / 86400000)} 天前
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => void doExport()} disabled={busy}>
            <Download size={16} />
            导出备份
          </Button>
          <Button onClick={() => importRef.current?.click()} disabled={busy}>
            <Upload size={16} />
            导入备份
          </Button>
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (file) setPendingImport(file);
          }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const freed = await collectOrphans();
            toast.show(freed > 0 ? `已清理 ${formatBytes(freed)}` : '没有可清理的图片', 'info');
            refreshUsage();
          }}
          className="mt-3 text-xs text-zinc-400 underline-offset-2 hover:underline"
        >
          清理未被引用的图片
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          数据只保存在这台设备的浏览器里，换设备或清理浏览器数据都会丢失，请定期导出备份（建议放网盘）。
        </p>
      </Section>

      <Section title="分类">
        <div className="space-y-1">
          {subjects.map((s) => {
            const list = chapters.filter((c) => c.subjectId === s.id).sort((a, b) => a.order - b.order);
            const open = openSubject === s.id;
            return (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => setOpenSubject(open ? null : s.id)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left"
                >
                  <span className="flex items-center gap-2 text-sm text-zinc-800">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    {list.length} 章
                    <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
                  </span>
                </button>
                {open && (
                  <div className="mb-2 space-y-1 rounded-lg bg-zinc-50 p-2">
                    {list.map((c) => (
                      <div key={c.id} className="px-2 py-1 text-xs text-zinc-600">
                        {c.name}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input
                        value={newChapter}
                        onChange={(e) => setNewChapter(e.target.value)}
                        placeholder="新增章节名"
                        className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-orange-300"
                      />
                      <Button
                        size="sm"
                        onClick={async () => {
                          const name = newChapter.trim();
                          if (!name) return;
                          await createChapter(s.id, name);
                          setNewChapter('');
                          toast.show('已添加章节', 'success');
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="关于">
        <div className="space-y-1.5 text-xs leading-relaxed text-zinc-500">
          <p>错题簿 v0.1.0 · 本地优先的考研错题复习工具</p>
          <p>排期算法：FSRS-5，目标保留率 90%</p>
          <p>学习日边界：每天 04:00（凌晨复习算前一天）</p>
          <p>当前 M1：录入、错题本、复习、备份。手写批注与 PDF 截题在后续版本。</p>
        </div>
      </Section>

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="确认导入？"
        size="sm"
      >
        <p className="text-sm leading-relaxed text-zinc-600">
          将导入 <b>{pendingImport?.name}</b>。
          <br />
          同 id 的题目会以备份内容为准，设备上其他题目不会被删除。
        </p>
        <div className="mt-5 flex gap-3">
          <Button block onClick={() => setPendingImport(null)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" block onClick={() => void doImport()} disabled={busy}>
            {busy ? '导入中…' : '导入'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
