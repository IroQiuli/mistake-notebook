import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { useBack, useGo } from '../../hooks/useBack';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  History,
  RotateCw,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import {
  calcHistoryOverview,
  enrichReviewLogs,
  filterReviewLogs,
  groupReviewLogsByDay,
  type EnrichedReviewLog,
  type RatingFilter,
} from '../../domain/history';
import { formatDue, formatDuration, learningDayStart } from '../../domain/time';
import { practiceProblem } from '../../storage/problems';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { ZoomableImage } from '../../ui/ZoomableImage';
import {
  MikuChibiDizzy,
  MikuChibiThinking,
  MikuChibiThumbsUp,
  MikuChibiSparkle,
  MikuChibiSprint,
} from '../../ui/MikuChibi';

type DatePreset = 'all' | 'today' | '7days' | '30days';

interface HistoryViewProps {
  standalone?: boolean;
}

function ProblemItemRow({
  log,
  now,
  isMiku,
  onImageClick,
  onPractice,
}: {
  log: EnrichedReviewLog;
  now: number;
  isMiku: boolean;
  onImageClick: (url: string) => void;
  onPractice: (problemId: string) => void;
}) {
  const go = useGo();
  const stemUrl = useAssetUrl(log.problem?.thumbAssetId ?? log.problem?.stemAssetId);

  // 格式化时间与用时
  const d = new Date(log.reviewedAt);
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const durationText = log.durationMs > 0 ? formatDuration(log.durationMs) : '秒答';

  // 评级表情与标签
  const renderRatingBadge = () => {
    switch (log.rating) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 ring-1 ring-rose-200/50">
            {isMiku ? <MikuChibiDizzy size={18} className="-my-1" /> : null}
            忘记 · 需重点复习
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200/50">
            {isMiku ? <MikuChibiThinking size={18} className="-my-1" /> : null}
            困难 · 记忆模糊
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200/50">
            {isMiku ? <MikuChibiThumbsUp size={18} className="-my-1" /> : null}
            良好 · 掌握牢固
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200/50">
            {isMiku ? <MikuChibiSparkle size={18} className="-my-1" /> : null}
            熟练 · 轻松秒杀
          </span>
        );
      case 0:
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/50">
            手动改期
          </span>
        );
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col sm:flex-row gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-3.5 transition-all hover:border-zinc-300 hover:shadow-xs',
        isMiku && 'hover:border-teal-200'
      )}
    >
      {/* 题干缩略图 (点击看全屏大图) */}
      <div
        className="relative h-28 sm:h-24 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-100 cursor-zoom-in"
        onClick={() => stemUrl && onImageClick(stemUrl)}
        title="点击查看高清大图"
      >
        {stemUrl ? (
          <img
            src={stemUrl}
            alt="题干预览"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            暂无题干图片
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur transition-opacity">
            放大查看
          </span>
        </div>
        {log.subject && (
          <span
            className="absolute inset-x-0 bottom-0 h-1"
            style={{ backgroundColor: log.subject.color }}
          />
        )}
      </div>

      {/* 题目信息与做题心得 */}
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div>
          {/* 顶部标签行：科目 · 章节 · 评级 · 做题时刻 */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {log.subject && (
              <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: log.subject.color }}
                />
                {log.subject.name.replace('839 自动控制原理及过程控制', '839 自控')}
              </span>
            )}
            {log.chapter && (
              <span className="text-zinc-400">· {log.chapter.name}</span>
            )}
            <span className="ml-auto text-[11px] tabular-nums text-zinc-400">
              {timeStr} · 用时 {durationText}
            </span>
          </div>

          {/* 题目标题 */}
          <h3
            onClick={() => log.problem && go(`/problem/${log.problem.id}`)}
            className="mt-1 text-sm font-semibold text-zinc-900 line-clamp-1 cursor-pointer hover:text-teal-600 transition-colors"
          >
            {log.title}
          </h3>

          {/* 错因标签 */}
          {log.problem?.errorTags && log.problem.errorTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {log.problem.errorTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700 ring-1 ring-orange-200/40"
                >
                  <Tag size={10} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 避坑心得 / 错因记录摘要 */}
          {log.problem?.wrongNote && (
            <div className="mt-1.5 rounded-lg bg-zinc-50 px-2 py-1 text-[11px] leading-relaxed text-zinc-600 border-l-2 border-amber-400">
              <span className="font-medium text-zinc-700 mr-1">错因避坑:</span>
              <span className="line-clamp-2">{log.problem.wrongNote}</span>
            </div>
          )}
        </div>

        {/* 底部操作与下次排期 */}
        <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 text-xs">
          <div className="flex items-center gap-2">
            {renderRatingBadge()}
            {log.nextDue > 0 && (
              <span className="text-[10px] text-zinc-400">
                下次：{formatDue(log.nextDue, now)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => log.problem && onPractice(log.problem.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50/60 px-2 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-100 active:scale-95 transition-all"
              title="把这道题提前拉入今日复习队列"
            >
              <RotateCw size={11} />
              加练
            </button>
            <button
              type="button"
              onClick={() => log.problem && go(`/problem/${log.problem.id}`)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all"
            >
              详情
              <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryView({ standalone = false }: HistoryViewProps) {
  const navigate = useNavigate();
  const back = useBack('/');
  const toast = useToast();
  const [now] = useState(() => Date.now());

  const theme = useLiveQuery(() => getSetting<string>('theme', 'miku'), [], 'miku');
  const isMiku = theme === 'miku';

  const rawLogs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const rawProblems = useLiveQuery(() => db.problems.toArray(), [], []);
  const rawChapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const rawSubjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);

  // 筛选与搜索状态
  const [keyword, setKeyword] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>(undefined);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => new Set());
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  // 建立映射表
  const problemMap = useMemo(() => new Map(rawProblems.map((p) => [p.id, p])), [rawProblems]);
  const chapterMap = useMemo(() => new Map(rawChapters.map((c) => [c.id, c])), [rawChapters]);
  const subjectMap = useMemo(() => new Map(rawSubjects.map((s) => [s.id, s])), [rawSubjects]);

  // 组装并筛选日志
  const enrichedLogs = useMemo(
    () => enrichReviewLogs(rawLogs, problemMap, chapterMap, subjectMap),
    [rawLogs, problemMap, chapterMap, subjectMap]
  );

  // 全局概览统计
  const overview = useMemo(() => calcHistoryOverview(enrichedLogs), [enrichedLogs]);

  // 日期范围计算
  const dateRange = useMemo(() => {
    const todayStart = learningDayStart(now);
    if (datePreset === 'today') {
      return { since: todayStart };
    }
    if (datePreset === '7days') {
      return { since: todayStart - 6 * 24 * 3600 * 1000 };
    }
    if (datePreset === '30days') {
      return { since: todayStart - 29 * 24 * 3600 * 1000 };
    }
    return {};
  }, [datePreset, now]);

  // 条件筛选后的日志
  const filteredLogs = useMemo(() => {
    return filterReviewLogs(enrichedLogs, {
      subjectId: subjectFilter,
      ratingFilter,
      keyword,
      ...dateRange,
    });
  }, [enrichedLogs, subjectFilter, ratingFilter, keyword, dateRange]);

  // 按学习日分组
  const dayGroups = useMemo(() => groupReviewLogsByDay(filteredLogs, now), [filteredLogs, now]);

  // 切换折叠天
  const toggleCollapse = (dayKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  // 单题加练
  const handlePractice = async (problemId: string) => {
    const success = await practiceProblem(problemId);
    if (success) {
      toast.show('已把该题提前加入今日复习队列！', 'success');
    } else {
      toast.show('未能加入队列', 'info');
    }
  };

  return (
    <div className="space-y-4">
      {/* 独立页面头部导航 */}
      {standalone && (
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={back}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all shadow-xs"
              aria-label="返回上一页"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-zinc-900">往日做题记录</h1>
                {isMiku && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600 ring-1 ring-teal-200/50">
                    Miku 复习足迹
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">系统性查看以往所有刷题、复习与攻克明细</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold tabular-nums text-zinc-700">
              共 {overview.totalReviews} 次
            </span>
            <div className="text-[10px] text-zinc-400">累计复习记录</div>
          </div>
        </div>
      )}

      {/* 统计指标卡片 (总览) */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">累计复习</span>
            <History size={16} className={isMiku ? 'text-teal-500' : 'text-orange-500'} />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">
              {overview.totalReviews}
            </span>
            <span className="text-xs text-zinc-400">次</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">覆盖 {overview.uniqueProblems} 道不同错题</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">坚持学习</span>
            <Calendar size={16} className="text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">
              {overview.activeDays}
            </span>
            <span className="text-xs text-zinc-400">天</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">留下复习足迹的天数</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">综合攻克率</span>
            <CheckCircle2 size={16} className="text-sky-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">
              {Math.round(overview.overallAccuracy * 100)}%
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            良好与熟练共 {overview.rememberedCount} 次
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">总计用时</span>
            <Clock size={16} className="text-purple-500" />
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 truncate">
            {overview.formattedDuration}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">全情投入的专注时间</div>
        </div>
      </section>

      {/* 检索与筛选栏 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-3">
        {/* 关键字搜索输入框 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索题干内容、章节、错因分析或避坑心得..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-8 text-xs text-zinc-800 placeholder-zinc-400 outline-hidden transition-colors focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* 日期预设快速切换 */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar">
          <span className="text-zinc-400 shrink-0 text-[11px]">时间:</span>
          {(
            [
              { key: 'all', label: '全部时间' },
              { key: 'today', label: '仅看今天' },
              { key: '7days', label: '近 7 天' },
              { key: '30days', label: '近 30 天' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setDatePreset(item.key)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0',
                datePreset === item.key
                  ? isMiku
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 科目筛选 */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-zinc-400 shrink-0 text-[11px]">科目:</span>
          <button
            type="button"
            onClick={() => setSubjectFilter(undefined)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0',
              !subjectFilter
                ? 'bg-zinc-800 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
            )}
          >
            全部科目
          </button>
          {rawSubjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectFilter(s.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0',
                subjectFilter === s.id
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
            </button>
          ))}
        </div>

        {/* 状态评级筛选 */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-zinc-400 shrink-0 text-[11px]">结果:</span>
          {(
            [
              { key: 'all', label: '全部状态' },
              { key: 'weak', label: '需补强 (忘记/困难)' },
              { key: 'good', label: '掌握良好 (记得/熟练)' },
              { key: 'rescheduled', label: '手动改期' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRatingFilter(item.key)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0',
                ratingFilter === item.key
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 做题历史列表 (按天分组) */}
      <section className="space-y-4">
        {dayGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-10 text-center">
            {isMiku && (
              <div className="mb-3 flex justify-center">
                <MikuChibiSprint size={80} className="drop-shadow-xs" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-zinc-700">没有找到匹配的做题记录</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {enrichedLogs.length === 0
                ? '还没有开始复习，快去今日清单里开始刷题吧！'
                : '当前筛选条件下暂无做题记录，可以调整筛选或搜索关键字。'}
            </p>
            {enrichedLogs.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/review')}
                className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-500 active:scale-95 transition-all"
              >
                前往今日复习
              </button>
            )}
          </div>
        ) : (
          dayGroups.map((group) => {
            const isCollapsed = collapsedDays.has(group.dayKey);
            return (
              <div
                key={group.dayKey}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3"
              >
                {/* 学习日聚合标题 */}
                <div
                  className="flex items-center justify-between cursor-pointer select-none group"
                  onClick={() => toggleCollapse(group.dayKey)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-lg px-2 py-0.5 text-xs font-bold',
                        group.label === '今天'
                          ? 'bg-teal-500 text-white'
                          : group.label === '昨天'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-zinc-100 text-zinc-700'
                      )}
                    >
                      {group.label}
                    </span>
                    <span className="text-xs font-medium text-zinc-700">
                      {group.fullDateStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">
                      完成 <b className="text-zinc-700">{group.totalCount}</b> 题 · 用时{' '}
                      {formatDuration(group.totalDurationMs)} · 正确率{' '}
                      <span
                        className={cn(
                          'font-semibold',
                          group.accuracyRate >= 0.8
                            ? 'text-emerald-600'
                            : group.accuracyRate >= 0.5
                            ? 'text-amber-600'
                            : 'text-rose-500'
                        )}
                      >
                        {Math.round(group.accuracyRate * 100)}%
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        'text-zinc-400 transition-transform duration-200',
                        isCollapsed && '-rotate-90'
                      )}
                    />
                  </div>
                </div>

                {/* 题目卡片列表 */}
                {!isCollapsed && (
                  <div className="space-y-2.5 pt-1">
                    {group.logs.map((log) => (
                      <ProblemItemRow
                        key={log.id}
                        log={log}
                        now={now}
                        isMiku={isMiku}
                        onImageClick={(url) => setFullscreenUrl(url)}
                        onPractice={handlePractice}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 沉浸式真·全屏图片放大弹窗 */}
      {fullscreenUrl && (
        <ZoomableImage
          src={fullscreenUrl}
          alt="题目高清图"
          initialFullscreen={true}
          onClose={() => setFullscreenUrl(null)}
        />
      )}
    </div>
  );
}
