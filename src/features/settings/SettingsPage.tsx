import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Download, HardDrive, Lock, Plus, ShieldCheck, Upload } from 'lucide-react';
import { db, getSetting, setSetting } from '../../storage/db';
import { backupFilename, downloadBlob, exportBackup, importBackup } from '../../storage/backup';
import {
  BackupCryptoError,
  decryptBackup,
  encryptBackup,
  isEncryptedBackupFile,
} from '../../storage/crypto';
import { checkIntegrity, flagMissingAssets, type IntegrityReport } from '../../storage/integrity';
import { persistenceState, requestPersistence, type PersistState } from '../../storage/persistence';
import { collectOrphans, formatBytes, storageUsage } from '../../storage/assets';
import { createChapter } from '../../storage/problems';
import { canvasToBlob, prepareImage } from '../capture/pipeline';
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

const PERSIST_LABEL: Record<PersistState, string> = {
  granted: '已持久化',
  denied: '未持久化',
  unsupported: '不支持',
};

export default function SettingsPage() {
  const toast = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ file: File; encrypted: boolean } | null>(null);
  const [importPwd, setImportPwd] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPwd, setExportPwd] = useState('');
  const [exportPwd2, setExportPwd2] = useState('');
  const [encryptOn, setEncryptOn] = useState(true);
  const [goalInput, setGoalInput] = useState('20');
  const [usage, setUsage] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [persist, setPersist] = useState<PersistState>('unsupported');
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState('');
  /** 每科题量草稿：'' 表示不设（按到期全做），'0' 表示这科今天不做 */
  const [quotaDraft, setQuotaDraft] = useState<Record<string, string>>({});

  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const problems = useLiveQuery(() => db.problems.count(), [], 0);
  const assets = useLiveQuery(() => db.assets.count(), [], 0);
  const lastBackupAt = useLiveQuery(() => getSetting<number>('lastBackupAt', 0), [], 0);
  const wallpaper = useLiveQuery(() => getSetting<string>('wallpaper', ''), [], '');
  const wallRef = useRef<HTMLInputElement>(null);

  const refreshUsage = () => {
    storageUsage().then(setUsage).catch(() => {});
    persistenceState().then(setPersist).catch(() => {});
  };

  useEffect(() => {
    refreshUsage();
  }, [problems, assets]);

  useEffect(() => {
    getSetting<number>('dailyGoal', 20)
      .then((v) => setGoalInput(String(v)))
      .catch(() => {});
    getSetting<Record<string, number>>('subjectGoals', {})
      .then((goals) => {
        const draft: Record<string, string> = {};
        for (const [sid, n] of Object.entries(goals ?? {})) draft[sid] = String(n);
        setQuotaDraft(draft);
      })
      .catch(() => {});
  }, []);

  const openExport = () => {
    setExportPwd('');
    setExportPwd2('');
    setEncryptOn(true);
    setExportOpen(true);
  };

  const doExport = async () => {
    if (encryptOn) {
      if (exportPwd.length < 6) {
        toast.show('密码至少 6 位', 'error');
        return;
      }
      if (exportPwd !== exportPwd2) {
        toast.show('两次输入的密码不一致', 'error');
        return;
      }
    }
    setBusy(true);
    try {
      const zip = await exportBackup();
      const blob = encryptOn ? await encryptBackup(zip, exportPwd) : zip;
      downloadBlob(blob, backupFilename(Date.now(), encryptOn));
      toast.show(
        encryptOn ? '加密备份已生成，请连同密码一起保存' : '备份已生成，请保存到网盘',
        'success'
      );
      setExportOpen(false);
      refreshUsage();
    } catch (err) {
      console.error(err);
      toast.show('导出失败：' + (err instanceof Error ? err.message : '未知错误'), 'error');
    } finally {      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    const { file, encrypted } = pendingImport;
    setBusy(true);
    try {
      let zip: Blob = file;
      if (encrypted) {
        if (!importPwd) {
          toast.show('请输入备份密码', 'error');
          setBusy(false);
          return;
        }
        zip = await decryptBackup(file, importPwd);
      }
      const result = await importBackup(zip);
      toast.show(
        `导入完成：${result.problems} 道题、${result.assets} 张图${
          result.missingAssets ? `，${result.missingAssets} 张缺图` : ''
        }`,
        'success'
      );
      setPendingImport(null);
      setImportPwd('');
      refreshUsage();
      setReport(null);
    } catch (err) {
      if (!(err instanceof BackupCryptoError)) console.error(err);
      toast.show('导入失败：' + (err instanceof Error ? err.message : '格式不对'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doCheck = async () => {
    setChecking(true);
    try {
      const r = await checkIntegrity();
      setReport(r);
      if (!r.ok) {
        const fixed = await flagMissingAssets();
        if (fixed > 0) toast.show(`已标记 ${fixed} 道缺图题目`, 'info');
      }
    } finally {
      setChecking(false);
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
          <span className="flex items-center gap-1.5 text-xs text-zinc-600">
            <ShieldCheck size={14} className={persist === 'granted' ? 'text-emerald-500' : 'text-zinc-400'} />
            存储状态：{PERSIST_LABEL[persist]}
          </span>
          {persist !== 'granted' && (
            <button
              type="button"
              className="text-[11px] text-orange-600 underline-offset-2 active:opacity-60"
              onClick={async () => {
                const next = await requestPersistence();
                setPersist(next);
                toast.show(
                  next === 'granted' ? '已申请持久化存储' : '浏览器暂未同意，多使用几天后再试',
                  next === 'granted' ? 'success' : 'info'
                );
              }}
            >
              申请持久化
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
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
          <Button variant="primary" onClick={openExport} disabled={busy}>
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
          data-testid="import-file"
          type="file"
          accept=".zip,.ctbx,application/zip,application/octet-stream"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (!file) return;
            const encrypted = await isEncryptedBackupFile(file).catch(() => false);
            setImportPwd('');
            setPendingImport({ file, encrypted });
          }}
        />

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const freed = await collectOrphans();
              toast.show(freed > 0 ? `已清理 ${formatBytes(freed)}` : '没有可清理的图片', 'info');
              refreshUsage();
            }}
            className="text-xs text-zinc-400 underline-offset-2 hover:underline"
          >
            清理未被引用的图片
          </button>
          <button
            type="button"
            onClick={() => void doCheck()}
            disabled={checking}
            className="text-xs text-zinc-400 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {checking ? '检查中…' : '检查数据完整性'}
          </button>
        </div>

        {report && (
          <div
            className={cn(
              'mt-2 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed',
              report.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
            )}
          >
            {report.ok ? (
              <>✓ 引用完整：{report.problems} 道题、{report.assets} 张图的引用都能对上</>
            ) : (
              <>
                发现 {report.missingStem} 道题缺题干图、{report.missingAnswer} 处答案图缺失、
                {report.orphanAssets} 张无引用图片、{report.orphanCards} 条孤立复习卡。
                <br />
                缺图多为导入不完整或清理过站点数据，可用备份重新导入修复。
              </>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          数据只保存在这台设备的浏览器里，换设备或清理浏览器数据都会丢失。
          {persist === 'granted'
            ? '浏览器已承诺不主动清理本站数据。'
            : '建议申请持久化存储，并定期导出加密备份放网盘。'}
        </p>
      </Section>

      <Section title="外观">
        <div className="flex items-center gap-3">
          <div
            className="h-16 w-24 shrink-0 rounded-lg bg-zinc-100 ring-1 ring-zinc-200"
            style={
              wallpaper
                ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover' }
                : undefined
            }
          >
            {!wallpaper && (
              <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                无壁纸
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-800">背景壁纸</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
              压缩到 1080px 宽再存，卡片仍是白底不影响阅读
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button block onClick={() => wallRef.current?.click()}>
            <Upload size={15} />
            {wallpaper ? '换一张' : '上传壁纸'}
          </Button>
          {wallpaper && (
            <Button
              block
              onClick={async () => {
                await setSetting('wallpaper', '');
                toast.show('已移除壁纸', 'info');
              }}
            >
              移除
            </Button>
          )}
        </div>

        <input
          ref={wallRef}
          data-testid="wallpaper-file"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const { canvas } = await prepareImage(file, 1080);
              const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
              });
              await setSetting('wallpaper', dataUrl);
              toast.show('壁纸已更新', 'success');
            } catch (err) {
              console.error(err);
              toast.show('上传失败', 'error');
            }
          }}
        />
      </Section>

      <Section title="学习目标">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">每科每天几道（留空 = 按到期全做）</span>
          <span className="text-[11px] text-zinc-400">
            合计{' '}
            {Object.values(quotaDraft).reduce((s, v) => s + (Number(v) || 0), 0)} 道
          </span>
        </div>

        <ul className="mt-2 space-y-1.5">
          {subjects.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
                {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={quotaDraft[s.id] ?? ''}
                placeholder="不限"
                onChange={(e) =>
                  setQuotaDraft((prev) => ({
                    ...prev,
                    [s.id]: e.target.value.replace(/\D/g, '').slice(0, 2),
                  }))
                }
                className="h-9 w-14 rounded-lg border border-zinc-200 px-2 text-center text-sm outline-none placeholder:text-[11px] placeholder:text-zinc-300 focus:border-orange-300"
                aria-label={`${s.name} 每天题量`}
              />
              <span className="w-4 text-xs text-zinc-400">道</span>
            </li>
          ))}
        </ul>

        <Button
          size="sm"
          block
          className="mt-3"
          onClick={async () => {
            const next: Record<string, number> = {};
            for (const [sid, raw] of Object.entries(quotaDraft)) {
              if (raw === '') continue;
              next[sid] = Math.min(99, Math.max(0, Number(raw)));
            }
            await setSetting('subjectGoals', next);
            toast.show(
              Object.keys(next).length ? '已保存每科题量' : '已清空，按到期全做',
              'success'
            );
          }}
        >
          保存每科题量
        </Button>

        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          到期的题不够时，会自动从这一科「最快要到期」的题里补齐；超出的部分留到明天。
          填 0 表示这一科今天不做。
        </p>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
          <span className="text-xs text-zinc-500">全部留空时的总目标</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className="ml-auto h-9 w-16 rounded-lg border border-zinc-200 px-2 text-center text-sm outline-none focus:border-orange-300"
          />
          <span className="text-sm text-zinc-500">题</span>
          <Button
            size="sm"
            onClick={async () => {
              const n = Math.min(200, Math.max(1, Number(goalInput) || 20));
              await setSetting('dailyGoal', n);
              setGoalInput(String(n));
              toast.show('已保存目标', 'success');
            }}
          >
            保存
          </Button>
        </div>
      </Section>

      <Section title="分类">
        <div className="space-y-1">
          {subjects.map((s) => {
            const list = chapters
              .filter((c) => c.subjectId === s.id)
              .sort((a, b) => a.order - b.order);
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
                    <ChevronDown
                      size={14}
                      className={cn('transition-transform', open && 'rotate-180')}
                    />
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
          <p>错题簿 v0.8.0 · 本地优先的考研错题复习工具</p>
          <p>排期算法：FSRS-5，目标保留率 90%</p>
          <p>学习日边界：每天 04:00（凌晨复习算前一天）</p>
          <p>备份加密：PBKDF2-SHA256（60 万次迭代）+ AES-256-GCM</p>
          <p>当前版本：录入（拍照/相册/PDF）、手写批注、FSRS 复习、按科题量、套卷、统计与加密备份。</p>
        </div>
      </Section>

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} title="导出备份" size="sm">
        <label className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-zinc-700">
            <Lock size={15} className="text-zinc-400" />
            用密码加密（推荐）
          </span>
          <input
            type="checkbox"
            checked={encryptOn}
            onChange={(e) => setEncryptOn(e.target.checked)}
            className="h-5 w-5 accent-orange-500"
          />
        </label>

        {encryptOn ? (
          <div className="mt-3 space-y-2">
            <input
              type="password"
              value={exportPwd}
              onChange={(e) => setExportPwd(e.target.value)}
              placeholder="设置密码（至少 6 位）"
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-orange-300"
            />
            <input
              type="password"
              value={exportPwd2}
              onChange={(e) => setExportPwd2(e.target.value)}
              placeholder="再输一次"
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-orange-300"
            />
            <p className="text-[11px] leading-relaxed text-amber-700">
              密码不会保存在任何地方。忘记密码 = 备份无法恢复，请记在密码管理器里。
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
            不加密的备份是公开的压缩包，谁拿到都能看图。只建议临时在同设备间搬运。
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button block onClick={() => setExportOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" block onClick={() => void doExport()} disabled={busy}>
            {busy ? '生成中…' : '生成备份'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="导入备份"
        size="sm"
      >
        <p className="text-sm leading-relaxed text-zinc-600">
          {pendingImport?.encrypted ? '这是一个加密备份，请输入导出时设置的密码。' : '将导入'}{' '}
          <b className="break-all">{pendingImport?.file.name}</b>
        </p>

        {pendingImport?.encrypted && (
          <input
            type="password"
            value={importPwd}
            onChange={(e) => setImportPwd(e.target.value)}
            placeholder="备份密码"
            className="mt-3 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-orange-300"
          />
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          同 id 的题目以备份内容为准，设备上其他题目不会被删除。
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
