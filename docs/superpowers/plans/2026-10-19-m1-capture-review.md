# 错题簿 M1「能录能复习」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可在手机/平板浏览器打开、能录入错题图片并按 FSRS 自动排期复习的 PWA，数据本地存储且可导出恢复。

**Architecture:** 纯静态 React SPA。领域逻辑（排期、队列、筛选）为无副作用纯函数、全部单测覆盖；存储层用 Dexie 封装 IndexedDB（结构化数据 + Blob）；界面按页面切分，页面只做编排，不写业务规则。

**Tech Stack:** React 18 + TypeScript + Vite ｜ Dexie ｜ ts-fsrs ｜ Tailwind CSS v4 ｜ React Router (Hash) ｜ vite-plugin-pwa ｜ JSZip ｜ Vitest + Testing Library + fake-indexeddb

**依据规格：** `docs/superpowers/specs/2026-10-19-cuotiben-design.md`

---

## 文件结构（M1）

```
cuotiben/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
└── src/
    ├── main.tsx                 入口：挂载 + 请求持久化存储 + 种子数据
    ├── App.tsx                  路由与响应式外壳（底部 Tab / 左侧栏）
    ├── index.css                Tailwind 入口 + 设计变量
    ├── domain/
    │   ├── types.ts             全部实体类型
    │   ├── time.ts              学习日边界、日期格式化
    │   ├── taxonomy.ts          4 科 25 章节种子数据
    │   ├── scheduler.ts         FSRS 读写封装（纯函数）
    │   ├── queue.ts             取题与排序（纯函数）
    │   └── filter.ts            检索与筛选（纯函数）
    ├── storage/
    │   ├── db.ts                Dexie schema
    │   ├── seed.ts              首次启动写入分类模板
    │   ├── assets.ts            Blob 读写、缩略图、对象 URL 缓存
    │   ├── problems.ts          错题 CRUD（事务、级联删除）
    │   └── backup.ts            导出/导入 zip
    ├── features/
    │   ├── today/TodayPage.tsx
    │   ├── capture/
    │   │   ├── CapturePage.tsx  录入编排（来源→框选→增强→表单）
    │   │   ├── Cropper.tsx      框选器（拖拽矩形、多框）
    │   │   ├── pipeline.ts      解码、EXIF、缩放、裁剪、增强、缩略图
    │   │   └── ProblemForm.tsx  信息表单
    │   ├── library/
    │   │   ├── LibraryPage.tsx
    │   │   ├── ProblemRow.tsx
    │   │   └── FilterBar.tsx
    │   ├── problem/ProblemPage.tsx
    │   ├── review/
    │   │   ├── ReviewPage.tsx
    │   │   └── useSession.ts    会话状态机
    │   └── settings/SettingsPage.tsx
    ├── ui/
    │   ├── Button.tsx  Dialog.tsx  EmptyState.tsx
    │   ├── Toast.tsx   Sheet.tsx    Spinner.tsx
    └── test/setup.ts
```

**边界约定**

- `domain/` 不 import `storage/`，不 import React。
- `storage/` 只做持久化，不含业务判断（排期计算在 `domain/scheduler.ts`）。
- 页面组件通过 `useLiveQuery` 订阅数据，写操作走 `storage/` 导出的函数。
- 所有图片访问走 `assets.getUrl(id)`，返回的对象 URL 由缓存管理，组件卸载不主动 revoke。

---

## Task 1：脚手架、Tailwind、PWA 外壳

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "cuotiben",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dexie": "^4.0.11",
    "dexie-react-hooks": "^1.1.7",
    "jszip": "^3.10.1",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "ts-fsrs": "^4.7.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: 无 ERR，生成 `pnpm-lock.yaml`。

- [ ] **Step 3: 写 `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '错题簿',
        short_name: '错题簿',
        description: '考研错题收集与间隔复习',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
});
```

- [ ] **Step 4: 写 `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
    <meta name="theme-color" content="#f97316" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <title>错题簿</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 写 `src/index.css`**

```css
@import "tailwindcss";

@theme {
  --color-brand: #f97316;
  --color-ink: #18181b;
}

html, body, #root { height: 100%; }
body {
  @apply bg-zinc-50 text-zinc-900 antialiased;
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

- [ ] **Step 6: 写 `src/App.tsx` 路由骨架（页面先用占位，后续任务替换）**

```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<div className="p-6">今日</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 7: 写 `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: 生成图标**

用一段 Node 脚本或在线工具生成橙色底、白色「本子+对勾」的 512/192 PNG，放到 `public/`。验收：`public/icon-192.png` 存在且尺寸正确。

- [ ] **Step 9: 跑通开发服务器**

Run: `pnpm dev`
Expected: 输出 `Local: http://localhost:5173/`，浏览器打开显示「今日」。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "chore: 脚手架、Tailwind 与 PWA 外壳"
```

---

## Task 2：领域类型与学习日工具

**Files:**
- Create: `src/domain/types.ts`, `src/domain/time.ts`, `src/domain/time.test.ts`, `src/test/setup.ts`

- [ ] **Step 1: 写失败测试 `src/domain/time.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { learningDayStart, learningDayEnd, dayKey, formatDue } from './time';

const at = (s: string) => new Date(s).getTime();

describe('学习日边界（04:00）', () => {
  it('凌晨 2 点属于前一天', () => {
    expect(dayKey(at('2026-10-20T02:00:00'))).toBe('2026-10-19');
  });
  it('早上 5 点属于当天', () => {
    expect(dayKey(at('2026-10-20T05:00:00'))).toBe('2026-10-20');
  });
  it('学习日结束时间等于开始 + 24h', () => {
    const t = at('2026-10-19T14:00:00');
    expect(learningDayEnd(t) - learningDayStart(t)).toBe(24 * 3600 * 1000);
  });
  it('learningDayEnd 覆盖当天 23:59', () => {
    const t = at('2026-10-19T14:00:00');
    expect(at('2026-10-19T23:59:00')).toBeLessThan(learningDayEnd(t));
  });
});

describe('formatDue', () => {
  it('今天到期显示「今天」', () => {
    expect(formatDue(at('2026-10-19T10:00:00'), at('2026-10-19T14:00:00'))).toBe('今天');
  });
  it('逾期 3 天显示「逾期 3 天」', () => {
    expect(formatDue(at('2026-10-16T10:00:00'), at('2026-10-19T14:00:00'))).toBe('逾期 3 天');
  });
  it('3 天后显示「3 天后」', () => {
    expect(formatDue(at('2026-10-22T10:00:00'), at('2026-10-19T14:00:00'))).toBe('3 天后');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/domain/time.test.ts`
Expected: FAIL，`Cannot find module './time'`。

- [ ] **Step 3: 写 `src/domain/types.ts`**

复制规格 5.1 节的全部接口定义（`ID / Subject / Chapter / Topic / Problem / Card / ReviewLog / Asset / Stroke / Ink / Scratch / Setting`），并补充：

```ts
export type Rating = 1 | 2 | 3 | 4;
export const RATING_LABEL: Record<Rating, string> = { 1: '忘记', 2: '模糊', 3: '记得', 4: '熟练' };
export type CardState = 0 | 1 | 2 | 3;
```

- [ ] **Step 4: 写 `src/domain/time.ts`**

```ts
import type { Card } from './types';

export const DAY_START_HOUR = 4;

export function learningDayStart(t: number): number {
  const d = new Date(t);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

export function learningDayEnd(t: number): number {
  return learningDayStart(t) + 24 * 3600 * 1000;
}

export function dayKey(t: number): string {
  const d = new Date(learningDayStart(t));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 以学习日为单位的整数差：正数表示 future 在未来 */
export function dayDiff(future: number, now: number): number {
  const ms = learningDayStart(future) - learningDayStart(now);
  return Math.round(ms / (24 * 3600 * 1000));
}

export function formatDue(due: number, now: number): string {
  const diff = dayDiff(due, now);
  if (diff < 0) return `逾期 ${-diff} 天`;
  if (diff === 0) return '今天';
  return `${diff} 天后`;
}

export function isDue(card: Pick<Card, 'due'>, now: number): boolean {
  return card.due <= learningDayEnd(now);
}
```

- [ ] **Step 5: 写 `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 6: 运行测试**

Run: `pnpm test src/domain/time.test.ts`
Expected: 7 passed。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(domain): 学习日与到期格式化"
```

---

## Task 3：分类种子与数据库

**Files:**
- Create: `src/domain/taxonomy.ts`, `src/storage/db.ts`, `src/storage/seed.ts`, `src/storage/seed.test.ts`

- [ ] **Step 1: 写失败测试 `src/storage/seed.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { ensureSeeded } from './seed';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('首次启动种子', () => {
  it('写入 4 个科目与 36 个章节', async () => {
    await ensureSeeded();
    expect(await db.subjects.count()).toBe(4);
    expect(await db.chapters.count()).toBe(36);
  });
  it('重复调用不产生重复数据', async () => {
    await ensureSeeded();
    await ensureSeeded();
    expect(await db.subjects.count()).toBe(4);
    expect(await db.chapters.count()).toBe(36);
  });
  it('数学二包含 12 个章节且覆盖线代', async () => {
    await ensureSeeded();
    const math = (await db.subjects.where('name').equals('数学二').first())!;
    const names = (await db.chapters.where('subjectId').equals(math.id).toArray()).map((c) => c.name);
    expect(names).toHaveLength(12);
    expect(names).toContain('一元函数微分学');
    expect(names).toContain('二次型');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/storage/seed.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 写 `src/domain/taxonomy.ts`**

```ts
export interface SeedSubject {
  name: string;
  color: string;
  chapters: string[];
}

export const SEED_SUBJECTS: SeedSubject[] = [
  {
    name: '数学二',
    color: '#3b82f6',
    chapters: [
      '函数、极限与连续', '一元函数微分学', '一元函数积分学',
      '多元函数微分学', '二重积分', '常微分方程',
      '行列式', '矩阵', '向量', '线性方程组', '特征值与特征向量', '二次型'
    ]
  },
  {
    name: '英语二',
    color: '#22c55e',
    chapters: ['完形填空', '阅读理解', '新题型', '翻译', '写作', '词汇与语法']
  },
  {
    name: '政治',
    color: '#ef4444',
    chapters: ['马克思主义基本原理', '毛泽东思想和中国特色社会主义理论体系概论', '中国近现代史纲要', '思想道德与法治', '形势与政策']
  },
  {
    name: '839 自动控制原理及过程控制',
    color: '#f97316',
    chapters: [
      '自动控制的一般概念', '控制系统的数学模型', '线性系统的时域分析法',
      '根轨迹分析法', '线性系统的频域分析法', '线性系统的校正方法',
      '非线性控制系统分析', '线性离散控制系统',
      '过程检测及控制仪表', '被控过程特性的机理建模', '常规过程控制系统（单回路控制）',
      '复杂过程控制系统方案设计', '典型工业过程控制综合设计实战'
    ]
  }
];
```

> 章节数核对：数学二 12、英语二 6、政治 5、839 13，合计 36。

- [ ] **Step 4: 写 `src/storage/db.ts`**

```ts
import Dexie, { type Table } from 'dexie';
import type { Asset, Card, Chapter, Ink, Problem, ReviewLog, Scratch, Setting, Subject, Topic } from '../domain/types';

export class AppDb extends Dexie {
  subjects!: Table<Subject, string>;
  chapters!: Table<Chapter, string>;
  topics!: Table<Topic, string>;
  problems!: Table<Problem, string>;
  cards!: Table<Card, string>;
  reviewLogs!: Table<ReviewLog, string>;
  assets!: Table<Asset, string>;
  inks!: Table<Ink, string>;
  scratch!: Table<Scratch, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('cuotiben');
    this.version(1).stores({
      subjects: 'id, order, archived',
      chapters: 'id, subjectId, [subjectId+order]',
      topics: 'id, subjectId, name',
      problems: 'id, subjectId, chapterId, createdAt, archivedAt, *topicIds',
      cards: 'problemId, due, state',
      reviewLogs: 'id, problemId, reviewedAt',
      assets: 'id, kind, createdAt, sourceAssetId',
      inks: 'id, ownerId, ownerType, createdAt',
      scratch: 'id, updatedAt',
      settings: 'key'
    });
  }
}

export const db = new AppDb();
```

- [ ] **Step 5: 写 `src/storage/seed.ts`**

```ts
import { db } from './db';
import { SEED_SUBJECTS } from '../domain/taxonomy';

export async function ensureSeeded(): Promise<void> {
  const already = await db.settings.get('seeded');
  if (already) return;
  await db.transaction('rw', db.subjects, db.chapters, db.settings, async () => {
    for (let i = 0; i < SEED_SUBJECTS.length; i++) {
      const s = SEED_SUBJECTS[i];
      const subjectId = crypto.randomUUID();
      await db.subjects.add({ id: subjectId, name: s.name, color: s.color, order: i, archived: 0 });
      for (let j = 0; j < s.chapters.length; j++) {
        await db.chapters.add({ id: crypto.randomUUID(), subjectId, name: s.chapters[j], order: j });
      }
    }
    await db.settings.put({ key: 'seeded', value: true });
  });
}
```

- [ ] **Step 6: 运行测试**

Run: `pnpm test src/storage/seed.test.ts`
Expected: 3 passed。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(storage): Dexie schema 与分类种子"
```

---

## Task 4：FSRS 排期封装

**Files:**
- Create: `src/domain/scheduler.ts`, `src/domain/scheduler.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/scheduler.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { newCard, applyRating, previewIntervals } from './scheduler';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

describe('FSRS 封装', () => {
  it('新卡立即可用', () => {
    const c = newCard(T0);
    expect(c.due).toBe(T0);
    expect(c.reps).toBe(0);
    expect(c.state).toBe(0);
  });

  it('忘记的间隔最短', () => {
    const c = newCard(T0);
    const again = applyRating(c, 1, T0);
    const hard = applyRating(c, 2, T0);
    const good = applyRating(c, 3, T0);
    const easy = applyRating(c, 4, T0);
    expect(again.nextDue).toBeLessThanOrEqual(hard.nextDue);
    expect(hard.nextDue).toBeLessThanOrEqual(good.nextDue);
    expect(good.nextDue).toBeLessThan(easy.nextDue);
    expect(easy.nextDue).toBeGreaterThan(T0 + DAY);
  });

  it('多次记得后间隔递增', () => {
    let c = newCard(T0);
    let t = T0;
    const dues: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = applyRating(c, 3, t);
      c = r.card; t = r.nextDue; dues.push(r.nextDue);
    }
    expect(dues[1] - dues[0]).toBeGreaterThan(dues[0] - T0);
    expect(dues[2] - dues[1]).toBeGreaterThan(dues[1] - dues[0]);
  });

  it('复习卡评为忘记会记一次 lapse', () => {
    const base = newCard(T0, 'p1');
    const reviewCard = {
      ...base, state: 2 as const, reps: 3, stability: 5, difficulty: 5,
      scheduledDays: 5, learningSteps: 0, due: T0 + 5 * DAY
    };
    const r = applyRating(reviewCard, 1, T0 + 5 * DAY);
    expect(r.card.lapses).toBe(1);
  });

  it('预览四档间隔均为正且递增', () => {
    const c = applyRating(newCard(T0), 3, T0).card;
    const p = previewIntervals(c, T0 + 3 * DAY);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
    expect(p[1]).toBeGreaterThan(T0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/domain/scheduler.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 `src/domain/scheduler.ts`**

```ts
import { fsrs, createEmptyCard, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { Card, Rating as AppRating } from './types';

const engine = fsrs({ request_retention: 0.9, enable_fuzz: false });

function toFsrs(c: Card): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
    learning_steps: c.learningSteps
  } as FsrsCard;
}

function fromFsrs(problemId: string, c: FsrsCard): Card {
  return {
    problemId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review?.getTime(),
    learningSteps: c.learning_steps
  };
}

export function newCard(now: number, problemId = ''): Card {
  const empty = createEmptyCard(new Date(now));
  const card = fromFsrs(problemId, empty);
  card.due = now;
  return card;
}

export function applyRating(
  card: Card,
  rating: AppRating,
  now: number
): { card: Card; nextDue: number; prevDue: number; prevState: number } {
  const result = engine.next(toFsrs(card), new Date(now), rating as Grade);
  const next = fromFsrs(card.problemId, result.card);
  return { card: next, nextDue: next.due, prevDue: card.due, prevState: card.state };
}

export function previewIntervals(card: Card, now: number): Record<AppRating, number> {
  const scheduling = engine.repeat(toFsrs(card), new Date(now));
  return {
    1: scheduling[Rating.Again].card.due.getTime(),
    2: scheduling[Rating.Hard].card.due.getTime(),
    3: scheduling[Rating.Good].card.due.getTime(),
    4: scheduling[Rating.Easy].card.due.getTime()
  };
}
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test src/domain/scheduler.test.ts`
Expected: 5 passed。若 ts-fsrs 的 `repeat` 返回结构不同，按实际类型调整（`scheduling[Rating.X].card`）。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(domain): FSRS 排期封装"
```

---

## Task 5：复习队列与筛选

**Files:**
- Create: `src/domain/queue.ts`, `src/domain/queue.test.ts`, `src/domain/filter.ts`, `src/domain/filter.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/queue.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildQueue } from './queue';
import { newCard } from './scheduler';
import type { Card, Problem } from './types';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

const problem = (over: Partial<Problem> & { id: string }): Problem => ({
  id: over.id, subjectId: 's1', chapterId: 'c1', topicIds: [],
  stemAssetId: 'a1', answerAssetIds: [], wrongNote: '',
  difficulty: 3, createdAt: T0, updatedAt: T0, ...over
} as Problem);

const card = (id: string, due: number, state = 0): Card => ({ ...newCard(T0, id), due, state: state as Card['state'] });

describe('buildQueue', () => {
  it('只取到期且未归档', () => {
    const ps = [problem({ id: 'p1' }), problem({ id: 'p2', archivedAt: T0 })];
    const cs = [card('p1', T0 - DAY), card('p2', T0 - DAY)];
    expect(buildQueue(ps, cs, { now: T0 }).map((x) => x.problem.id)).toEqual(['p1']);
  });

  it('逾期最久的排最前', () => {
    const ps = [problem({ id: 'a' }), problem({ id: 'b' }), problem({ id: 'c' })];
    const cs = [card('a', T0 - DAY), card('b', T0 - 5 * DAY), card('c', T0 - 3 * DAY)];
    expect(buildQueue(ps, cs, { now: T0 }).map((x) => x.problem.id)).toEqual(['b', 'c', 'a']);
  });

  it('新题受上限约束，按创建时间先到先得', () => {
    const ps = [
      problem({ id: 'n1', createdAt: T0 - 3 * DAY }),
      problem({ id: 'n2', createdAt: T0 - 2 * DAY }),
      problem({ id: 'n3', createdAt: T0 - DAY })
    ];
    const cs = [card('n1', T0), card('n2', T0), card('n3', T0)];
    const q = buildQueue(ps, cs, { now: T0, newLimit: 2 });
    expect(q.map((x) => x.problem.id).sort()).toEqual(['n1', 'n2']);
  });

  it('newLimit = 0 表示不限', () => {
    const ps = [problem({ id: 'n1' }), problem({ id: 'n2' })];
    const cs = [card('n1', T0), card('n2', T0)];
    expect(buildQueue(ps, cs, { now: T0, newLimit: 0 })).toHaveLength(2);
  });

  it('凌晨 3 点仍能看到前一天到期的题', () => {
    const late = new Date('2026-10-20T03:00:00').getTime();
    const ps = [problem({ id: 'p1' })];
    const cs = [card('p1', T0)];
    expect(buildQueue(ps, cs, { now: late })).toHaveLength(1);
  });

  it('科目筛选生效', () => {
    const ps = [problem({ id: 'p1', subjectId: 's1' }), problem({ id: 'p2', subjectId: 's2' })];
    const cs = [card('p1', T0 - DAY), card('p2', T0 - DAY)];
    const q = buildQueue(ps, cs, { now: T0, subjectId: 's2' });
    expect(q.map((x) => x.problem.id)).toEqual(['p2']);
  });
});
```

- [ ] **Step 2: 运行确认失败 → 写 `src/domain/queue.ts`**

```ts
import type { Card, Problem } from './types';
import { learningDayEnd } from './time';

export interface QueueOptions {
  now: number;
  newLimit?: number;      // 默认 30；0 = 不限
  subjectId?: string;
  interleave?: boolean;   // 默认 true：按科目轮转
}

export interface QueueItem {
  problem: Problem;
  card: Card;
  overdueDays: number;
}

export function buildQueue(problems: Problem[], cards: Card[], opts: QueueOptions): QueueItem[] {
  const { now, newLimit = 30, subjectId, interleave = true } = opts;
  const end = learningDayEnd(now);
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));

  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const p of problems) {
    if (p.archivedAt) continue;
    if (subjectId && p.subjectId !== subjectId) continue;
    const c = cardMap.get(p.id);
    if (!c || c.due > end) continue;
    const overdueDays = Math.max(0, Math.floor((end - c.due) / 86400000));
    const item = { problem: p, card: c, overdueDays };
    if (c.state === 0) fresh.push(item);
    else due.push(item);
  }

  due.sort((a, b) => b.overdueDays - a.overdueDays || b.problem.difficulty - a.problem.difficulty || a.card.due - b.card.due);
  fresh.sort((a, b) => a.problem.createdAt - b.problem.createdAt);

  const limitedFresh = newLimit === 0 ? fresh : fresh.slice(0, newLimit);
  const all = [...due, ...limitedFresh];

  return interleave ? interleaveBySubject(all) : all;
}

function interleaveBySubject(items: QueueItem[]): QueueItem[] {
  const buckets = new Map<string, QueueItem[]>();
  for (const it of items) {
    const arr = buckets.get(it.problem.subjectId) ?? [];
    arr.push(it);
    buckets.set(it.problem.subjectId, arr);
  }
  const order = [...buckets.keys()];
  const out: QueueItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of order) {
      const arr = buckets.get(k)!;
      const next = arr.shift();
      if (next) { out.push(next); added = true; }
    }
  }
  return out;
}
```

- [ ] **Step 3: 运行队列测试**

Run: `pnpm test src/domain/queue.test.ts`
Expected: 6 passed。

- [ ] **Step 4: 写失败测试 `src/domain/filter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { filterProblems } from './filter';
import type { Chapter, Problem, Topic } from './types';

const T0 = 1_700_000_000_000;
const p = (over: Partial<Problem> & { id: string }): Problem => ({
  id: over.id, subjectId: 's1', chapterId: 'c1', topicIds: [],
  stemAssetId: 'a1', answerAssetIds: [], wrongNote: '',
  difficulty: 3, createdAt: T0, updatedAt: T0, ...over
} as Problem);

const chapters: Chapter[] = [
  { id: 'c1', subjectId: 's1', name: '根轨迹分析法', order: 1 },
  { id: 'c2', subjectId: 's1', name: '频域分析法', order: 2 }
];
const topics: Topic[] = [
  { id: 't1', subjectId: 's1', name: '广义根轨迹', usageCount: 1 },
  { id: 't2', subjectId: 's1', name: '奈奎斯特', usageCount: 1 }
];

describe('filterProblems', () => {
  const all = [
    p({ id: 'a', wrongNote: '忘记考虑阻尼比', sourcePaper: '2023真题', difficulty: 4, topicIds: ['t1'] }),
    p({ id: 'b', chapterId: 'c2', wrongNote: '画错图', difficulty: 2, topicIds: ['t2'] }),
    p({ id: 'c', archivedAt: T0, difficulty: 5 })
  ];

  it('无筛选返回全部', () => {
    expect(filterProblems(all, {}, chapters, topics)).toHaveLength(3);
  });

  it('关键词命中错误原因', () => {
    expect(filterProblems(all, { keyword: '阻尼' }, chapters, topics).map((x) => x.id)).toEqual(['a']);
  });

  it('关键词命中章节名', () => {
    expect(filterProblems(all, { keyword: '频域' }, chapters, topics).map((x) => x.id)).toEqual(['b']);
  });

  it('标签交集', () => {
    expect(filterProblems(all, { topicIds: ['t1'] }, chapters, topics).map((x) => x.id)).toEqual(['a']);
  });

  it('难度范围', () => {
    expect(filterProblems(all, { difficulty: [2, 3] }, chapters, topics).map((x) => x.id)).toEqual(['b']);
  });

  it('状态：已掌握', () => {
    expect(filterProblems(all, { status: 'archived' }, chapters, topics).map((x) => x.id)).toEqual(['c']);
  });

  it('关键词为空字符串不生效', () => {
    expect(filterProblems(all, { keyword: '   ' }, chapters, topics)).toHaveLength(3);
  });
});
```

- [ ] **Step 5: 运行确认失败 → 写 `src/domain/filter.ts`**

```ts
import type { Chapter, Problem, Topic } from './types';

export type StatusFilter = 'all' | 'due' | 'new' | 'archived';

export interface ProblemFilter {
  keyword?: string;
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  difficulty?: number[];
  status?: StatusFilter;
  years?: number[];
}

export function filterProblems(
  problems: Problem[],
  f: ProblemFilter,
  chapters: Chapter[],
  topics: Topic[],
  ctx?: { dueIds?: Set<string>; newIds?: Set<string> }
): Problem[] {
  const kw = f.keyword?.trim().toLowerCase() ?? '';
  const chapterName = new Map(chapters.map((c) => [c.id, c.name]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  return problems.filter((p) => {
    if (f.subjectId && p.subjectId !== f.subjectId) return false;
    if (f.chapterIds?.length && !f.chapterIds.includes(p.chapterId)) return false;
    if (f.topicIds?.length && !f.topicIds.every((t) => p.topicIds.includes(t))) return false;
    if (f.difficulty?.length && !f.difficulty.includes(p.difficulty)) return false;
    if (f.years?.length && (!p.sourceYear || !f.years.includes(p.sourceYear))) return false;

    const status = f.status ?? 'all';
    if (status === 'archived' && !p.archivedAt) return false;
    if (status !== 'archived' && p.archivedAt) return false;
    if (status === 'due' && !ctx?.dueIds?.has(p.id)) return false;
    if (status === 'new' && !ctx?.newIds?.has(p.id)) return false;

    if (kw) {
      const hay = [
        p.wrongNote,
        p.sourcePaper ?? '',
        p.sourceNo ?? '',
        String(p.sourceYear ?? ''),
        chapterName.get(p.chapterId) ?? '',
        ...p.topicIds.map((t) => topicName.get(t) ?? '')
      ].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}
```

> `status: 'new'` 与 `status: 'due'` 由调用方传入 `ctx.newIds` / `ctx.dueIds` 驱动；M1 只在「待复习」筛选中使用 `dueIds`。

- [ ] **Step 6: 运行全部领域测试**

Run: `pnpm test src/domain`
Expected: 全部 passed。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(domain): 复习队列与检索筛选"
```

---

## Task 6：图片管线（解码、EXIF、缩放、裁剪、增强、缩略图）

**Files:**
- Create: `src/features/capture/pipeline.ts`, `src/features/capture/pipeline.test.ts`, `src/storage/assets.ts`

- [ ] **Step 1: 写失败测试（纯几何部分）`pipeline.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { clampRect, fitWithin, rectToPixels } from './pipeline';

describe('几何工具', () => {
  it('fitWithin 保持比例并限制长边', () => {
    expect(fitWithin(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });

  it('clampRect 把越界矩形收回边界内', () => {
    const r = clampRect({ x: -0.1, y: -0.1, w: 2, h: 2 });
    expect(r).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('rectToPixels 用缩放系数换算并取整', () => {
    const px = rectToPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 1000, 800);
    expect(px).toEqual({ sx: 100, sy: 160, sw: 500, sh: 200 });
  });

  it('矩形过小时返回 null', () => {
    const px = rectToPixels({ x: 0.1, y: 0.1, w: 0.01, h: 0.01 }, 100, 100);
    expect(px).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败 → 写 `src/features/capture/pipeline.ts`**

```ts
export interface Rect { x: number; y: number; w: number; h: number } // 归一化 0–1

export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function clampRect(r: Rect): Rect {
  const x = Math.min(Math.max(0, r.x), 1);
  const y = Math.min(Math.max(0, r.y), 1);
  return { x, y, w: Math.min(r.w, 1 - x), h: Math.min(r.h, 1 - y) };
}

export function rectToPixels(
  r: Rect, imgW: number, imgH: number, min = 32
): { sx: number; sy: number; sw: number; sh: number } | null {
  const sx = Math.round(r.x * imgW);
  const sy = Math.round(r.y * imgH);
  const sw = Math.round(r.w * imgW);
  const sh = Math.round(r.h * imgH);
  if (sw < min || sh < min) return null;
  return { sx, sy, sw, sh };
}

export interface EnhanceOptions {
  brightness: number;   // 0.7 – 1.3
  contrast: number;     // 0.7 – 2.0
  grayscale: boolean;
  threshold: number;    // 0 = 关闭；80 – 200 开启二值化
}

export function buildFilter(o: EnhanceOptions): string {
  const parts = [`brightness(${o.brightness})`, `contrast(${o.contrast})`];
  if (o.grayscale) parts.push('grayscale(1)');
  return parts.join(' ');
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export async function drawToCanvas(
  src: ImageBitmap, sx: number, sy: number, sw: number, sh: number, opts: EnhanceOptions,
  outW?: number, outH?: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = outW ?? sw;
  canvas.height = outH ?? sh;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = buildFilter(opts);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (opts.threshold > 0) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const t = opts.threshold;
    for (let i = 0; i < data.data.length; i += 4) {
      const v = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
      const c = v > t ? 255 : 0;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = c;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime = 'image/jpeg', q = 0.85): Promise<Blob> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), mime, q));
}

export async function makeThumb(blob: Blob, maxEdge = 400): Promise<Blob> {
  const bmp = await decodeImage(blob);
  const { width, height } = fitWithin(bmp.width, bmp.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  return canvasToBlob(canvas, 'image/jpeg', 0.8);
}
```

- [ ] **Step 3: 写 `src/storage/assets.ts`**

```ts
import { db } from './db';
import type { Asset } from '../domain/types';

const urlCache = new Map<string, string>();

export async function putAsset(
  blob: Blob, kind: Asset['kind'], size: { width: number; height: number }, sourceAssetId?: string
): Promise<string> {
  const id = crypto.randomUUID();
  await db.assets.add({
    id, kind, sourceAssetId, blob, width: size.width, height: size.height,
    mime: blob.type, bytes: blob.size, createdAt: Date.now()
  });
  return id;
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return db.assets.get(id);
}

export async function getUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const a = await db.assets.get(id);
  if (!a) return null;
  const url = URL.createObjectURL(a.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteAssets(ids: string[]): Promise<void> {
  for (const id of ids) {
    const url = urlCache.get(id);
    if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
  }
  await db.assets.bulkDelete(ids);
}

/** 删除没有任何 problem 引用的图片，返回释放的字节数 */
export async function collectOrphans(): Promise<number> {
  const problems = await db.problems.toArray();
  const used = new Set<string>();
  for (const p of problems) {
    used.add(p.stemAssetId);
    p.answerAssetIds.forEach((a) => used.add(a));
  }
  const all = await db.assets.toArray();
  const orphans = all.filter((a) => !used.has(a.id));
  const bytes = orphans.reduce((s, a) => s + a.bytes, 0);
  await deleteAssets(orphans.map((a) => a.id));
  return bytes;
}
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test src/features/capture/pipeline.test.ts`
Expected: 4 passed。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(capture): 图片解码/缩放/裁剪/增强管线"
```

---

## Task 7：错题 CRUD 与录入界面

**Files:**
- Create: `src/storage/problems.ts`, `src/features/capture/Cropper.tsx`, `src/features/capture/ProblemForm.tsx`, `src/features/capture/CapturePage.tsx`
- Create: `src/storage/problems.test.ts`, `src/ui/*`

- [ ] **Step 1: 写失败测试 `src/storage/problems.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { createProblem, deleteProblem, markArchived } from './problems';
import { newCard } from '../domain/scheduler';

beforeEach(async () => {
  await db.delete(); await db.open();
  await db.subjects.add({ id: 's1', name: '数学二', color: '#000', order: 0, archived: 0 });
  await db.chapters.add({ id: 'c1', subjectId: 's1', name: '矩阵', order: 0 });
});

const input = () => ({
  subjectId: 's1', chapterId: 'c1', topicIds: [], stemAssetId: 'a1',
  answerAssetIds: [], wrongNote: '秩算错', difficulty: 3 as const
});

describe('createProblem', () => {
  it('同时写入题目与卡片，due 为当前时间', async () => {
    const now = Date.now();
    const id = await createProblem(input(), now);
    const p = await db.problems.get(id);
    const c = await db.cards.get(id);
    expect(p).toBeTruthy();
    expect(c!.due).toBe(now);
    expect(c!.state).toBe(0);
  });

  it('删除题目级联删除卡片与日志', async () => {
    const id = await createProblem(input(), Date.now());
    await db.reviewLogs.add({ id: 'r1', problemId: id, rating: 3, reviewedAt: Date.now(), durationMs: 1000, prevDue: 0, nextDue: 0, prevState: 0, nextState: 2 });
    await deleteProblem(id);
    expect(await db.problems.get(id)).toBeUndefined();
    expect(await db.cards.get(id)).toBeUndefined();
    expect(await db.reviewLogs.where('problemId').equals(id).count()).toBe(0);
  });

  it('归档后卡片保留但问题带 archivedAt', async () => {
    const id = await createProblem(input(), Date.now());
    await markArchived(id, true);
    const p = await db.problems.get(id);
    expect(p!.archivedAt).toBeGreaterThan(0);
    expect(await db.cards.get(id)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行确认失败 → 写 `src/storage/problems.ts`**

```ts
import { db } from './db';
import { newCard } from '../domain/scheduler';
import type { Problem } from '../domain/types';

export type ProblemInput = Omit<Problem, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

export async function createProblem(input: ProblemInput, now = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  const problem: Problem = { ...input, id, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.problems, db.cards, db.topics, async () => {
    await db.problems.add(problem);
    await db.cards.add({ ...newCard(now, id), due: now });
    for (const t of input.topicIds) {
      const topic = await db.topics.get(t);
      if (topic) await db.topics.update(t, { usageCount: topic.usageCount + 1 });
    }
  });
  return id;
}

export async function updateProblem(id: string, patch: Partial<ProblemInput>): Promise<void> {
  await db.problems.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteProblem(id: string): Promise<void> {
  await db.transaction('rw', db.problems, db.cards, db.reviewLogs, db.inks, db.assets, async () => {
    const p = await db.problems.get(id);
    if (p) {
      const assetIds = [p.stemAssetId, ...p.answerAssetIds].filter(Boolean);
      const thumbs = await db.assets.where('sourceAssetId').anyOf(assetIds).toArray();
      await db.assets.bulkDelete([...assetIds, ...thumbs.map((t) => t.id)]);
    }
    await db.inks.where('ownerId').equals(id).delete();
    await db.reviewLogs.where('problemId').equals(id).delete();
    await db.cards.delete(id);
    await db.problems.delete(id);
  });
}

export async function markArchived(id: string, archived: boolean): Promise<void> {
  await db.problems.update(id, { archivedAt: archived ? Date.now() : undefined, updatedAt: Date.now() });
}

export async function reschedule(id: string, due: number): Promise<void> {
  await db.cards.update(id, { due, scheduledDays: Math.max(0, Math.round((due - Date.now()) / 86400000)) });
}
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test src/storage/problems.test.ts`
Expected: 3 passed。

- [ ] **Step 4: 写通用 UI 组件（`src/ui/Button.tsx`、`Dialog.tsx`、`EmptyState.tsx`、`Toast.tsx`）**

要求：
- `Button`：`variant: primary | secondary | ghost | danger`，`size: sm | md | lg`，最小高度 44px，`aria-pressed` 透传。
- `Dialog`：`<dialog>` 元素 + `showModal()`，支持 Esc 关闭，点遮罩关闭，`role="dialog"`。
- `EmptyState`：图标 + 标题 + 说明 + 可选动作按钮。
- `Toast`：`useToast()` 返回 `show(msg, type)`，3 秒自动消失，`role="status"`。

- [ ] **Step 5: 写 `Cropper.tsx`**

要求：
- props：`src: string`（图片 URL）、`aspect?: number`、`onCrop(rect: Rect) => void`、`onCancel()`。
- 触摸与鼠标统一走 Pointer Events；拖拽生成矩形，四角手柄可调，松手后显示「裁剪」按钮确认。
- 矩形坐标归一化；框选过小（< 32px）时确认按钮禁用。
- 显示半透明遮罩突出选区。
- 验收：手机上用一根手指能稳定框选，双指缩放不影响选区（M1 先不做画布缩放）。

- [ ] **Step 6: 写 `ProblemForm.tsx`**

字段：科目（默认上次 `settings.lastSubjectId`）、章节（联动，支持「+ 新建章节」内联输入）、知识点标签（多选已有 + 输入新建）、难度 1–5 点选、来源年份/卷子/题号、错误原因文本框。

校验：科目与章节必填；错误原因可空；难度默认 3。提交时调用 `createProblem`，并写回 `settings.lastSubjectId`。

- [ ] **Step 7: 写 `CapturePage.tsx`**

状态机：`source → crop → enhance → form → done`。

- source：三个大按钮（拍照 / 相册 / PDF，PDF 在 M3 前显示「即将支持」并禁用）。
- crop：用 `Cropper`，支持多张；每张裁完压到队列。
- enhance：滑杆 + 实时预览（CSS filter 近似），确认时走 `drawToCanvas` 输出真图。
- form：`ProblemForm`。
- done：成功页，两个按钮「继续录下一题」（回到 crop，保留表单默认值）与「查看此题」。

验收：手机浏览器从相册选一张卷子照片 → 框选 → 保存 → 首页计数 +1。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat(capture): 错题录入流程"
```

---

## Task 8：错题本列表与详情

**Files:**
- Create: `src/features/library/LibraryPage.tsx`, `ProblemRow.tsx`, `FilterBar.tsx`, `src/features/problem/ProblemPage.tsx`

- [ ] **Step 1: 实现 `LibraryPage`**

- 顶部：科目 Tab（全部 + 4 科），右上「筛选」按钮打开 Sheet。
- 列表：`useLiveQuery` 读取 problems/chapters/topics/cards，按 `filterProblems` 过滤，按「最近录入」倒序。
- 行内容：缩略图 64px、科目色条、章节名、标签（前 2 个）、难度星、到期徽标（逾期 / 今天 / N 天后 / 已掌握）。
- 空状态：没有错题时引导「录第一道错题」；筛选无结果时给「清空筛选」。
- 分页：一次渲染 50 条，滚动到底加载更多（IntersectionObserver）。

- [ ] **Step 2: 实现 `FilterBar`**

- 章节多选（按科目分组）、知识点多选、难度多选、状态单选、年份多选、关键词输入（300ms 防抖）。
- 底部「重置」与「应用」，当前生效条件数显示在按钮上。

- [ ] **Step 3: 实现 `ProblemPage`**

- 大图（点开全屏预览，双指缩放）、答案图横向切换。
- 信息区：科目/章节/标签/难度/来源/错误原因。
- 操作：标记已掌握 / 取消归档、重新排期（今天/3 天后/7 天后/自定义）、删除（二次确认）、下载原图。
- 复习历史：最近 10 条评分与时间。

- [ ] **Step 4: 手动验证**

用 Task 7 录 3 道题，检查：列表排序、筛选、详情页跳转、归档后从列表消失（切到「已掌握」可见）。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(library): 错题本列表、筛选与详情"
```

---

## Task 9：复习会话

**Files:**
- Create: `src/features/review/useSession.ts`, `src/features/review/ReviewPage.tsx`

- [ ] **Step 1: 写 `useSession.ts`**

```ts
export interface SessionState {
  queue: QueueItem[];
  index: number;
  answersShown: boolean;
  startedAt: number;
  stats: { rating: Rating; ms: number }[];
  finished: boolean;
}
```

行为：
- 进入时用 `buildQueue` 冻结队列并写 `settings.lastSession = { ids, index }`。
- `reveal()` 显示答案；`rate(r)` 调 `applyRating`，事务内更新 Card、插入 ReviewLog（含 durationMs），`index + 1`。
- 队列耗尽 → `finished = true`。
- 退出时清除 `lastSession`；若存在 `lastSession`，首页给出「继续上次复习」入口。

- [ ] **Step 2: 写 `ReviewPage.tsx`**

- 顶部进度 `3/12` + 科目/章节 + 退出按钮（确认后退出）。
- 图片区：题干大图，`touch-action: none`，双指缩放（`transform: scale`），点击空白切换工具栏显隐。
- 工具栏：看答案、显示/隐藏我的旧批注（M2 前按钮禁用）、草稿板（M2 前禁用）。
- 看答案后：答案图 + 错误原因 + 最近 3 次评分；底部四档按钮，每档右上角小字显示 `previewIntervals` 的间隔天数。
- 快捷键：`1–4` 评分、`Space` 看答案、`Esc` 退出。
- 结束页：本轮题数、用时、四档分布、下次到期概览、「再复习一轮」（若有新到期）。

- [ ] **Step 3: 实现评分按钮的间隔预览**

用 `previewIntervals(card, now)`，把时间戳转成「今天 / 明天 / N 天后」显示，复用 `formatDue`。

- [ ] **Step 4: 手动验证**

录 3 题 → 复习全部，「忘记 / 记得 / 熟练」各一次 → 检查首页待复习数变化与详情页到期日期。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(review): FSRS 复习会话"
```

---

## Task 10：备份导出与导入

**Files:**
- Create: `src/storage/backup.ts`, `src/storage/backup.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { exportBackup, importBackup } from './backup';
import { ensureSeeded } from './seed';

beforeEach(async () => { await db.delete(); await db.open(); await ensureSeeded(); });

describe('备份回路', () => {
  it('导出再导入后实体数量一致', async () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    await db.assets.add({ id: 'a1', kind: 'stem', blob, width: 10, height: 10, mime: 'image/jpeg', bytes: 4, createdAt: 1 });
    await db.problems.add({ id: 'p1', subjectId: 's', chapterId: 'c', topicIds: [], stemAssetId: 'a1', answerAssetIds: [], wrongNote: 'x', difficulty: 3, createdAt: 1, updatedAt: 1 });
    await db.cards.add({ problemId: 'p1', due: 1, stability: 1, difficulty: 1, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: 0, learningSteps: 0 });

    const zip = await exportBackup();
    await db.delete(); await db.open(); await ensureSeeded();
    const result = await importBackup(zip);

    expect(result.problems).toBe(1);
    expect(await db.problems.count()).toBe(1);
    expect(await db.assets.count()).toBe(1);
    const asset = await db.assets.get('a1');
    expect(asset!.blob.size).toBe(4);
  });
});
```

- [ ] **Step 2: 运行确认失败 → 写 `backup.ts`**

使用 `JSZip`：
- `exportBackup(): Promise<Blob>` — `manifest.json`（format/appVersion/exportedAt/counts）、`data.json`（除 assets 外全部表 + settings）、`assets/{id}.bin`（Blob）、`README.txt`。
- `importBackup(file: Blob): Promise<{problems:number; assets:number}>` — 校验 format，逐表 upsert（`bulkPut`），图片按 id 还原 Blob；缺图问题标记 `missingAsset`。
- 导出后写 `settings.lastBackupAt`。

- [ ] **Step 3: 运行测试**

Run: `pnpm test src/storage/backup.test.ts`
Expected: 1 passed。

- [ ] **Step 4: 写设置页的备份区**

「导出备份」→ 触发下载 `cuotiben-backup-YYYY-MM-DD.zip`；「导入备份」→ 文件选择 + 确认弹窗（说明「同 id 覆盖，不会删除本地其他数据」）+ 结果统计；显示「上次备份：N 天前」与存储占用 `navigator.storage.estimate()`。

- [ ] **Step 5: 手动验证**

导出 → 用无痕窗口导入 → 对比题目、图片、复习记录。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat(storage): 备份导出与导入"
```

---

## Task 11：今日首页、响应式外壳与安装引导

**Files:**
- Create: `src/features/today/TodayPage.tsx`, `src/ui/TabBar.tsx`, `src/ui/InstallHint.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现 `TodayPage`**

- 头部：日期（如「10月19日 周一」）+ 连续复习天数（由 `reviewLogs` 按 `dayKey` 去重后从今天倒推计算）。
- 主按钮：`开始复习（N）`，N = 当前队列长度；点击进 `/review`。
- 科目小按钮：每个科目一行 `科目名 · N 题`，点击进 `/review?subject=xxx`。
- 三个统计卡：今日已复习 / 本周复习 / 未掌握错题数。
- 备份提醒条：`lastBackupAt` 距今 > 7 天或从未备份时显示。
- 最近录入：最近 4 道题的缩略图。
- 空状态：没有错题时展示「录第一道错题」引导。

- [ ] **Step 2: 实现响应式外壳**

- `<768px`：底部 Tab（今日/错题本/录入/统计/我的），中间「录入」做成凸起主按钮。
- `>=768px`：左侧栏 240px（Logo + 五个入口），右侧内容区最大宽 1100px 居中。
- 使用 `useMediaQuery` 或纯 CSS 断点；当前 Tab 高亮用 `NavLink`。

- [ ] **Step 3: 实现安装引导**

- 检测 `window.matchMedia('(display-mode: standalone)')`；非独立模式时在首页顶部显示一条可关闭提示。
- iOS 文案：「点分享 → 添加到主屏幕」；Android/桌面：「浏览器菜单 → 安装应用」。
- 关闭状态存 `settings.installHintDismissed`。

- [ ] **Step 4: 补齐路由**

`/`、`/library`、`/problem/:id`、`/capture`、`/review`、`/settings`，未知路径回首页。

- [ ] **Step 5: 端到端手动验收（M1 验收清单）**

1. 手机 + 平板各打开一次，界面不横向溢出。
2. 录 3 题 → 刷新 → 首页显示「待复习 3」。
3. 复习 3 题，分别「忘记/记得/熟练」→ 详情页到期时间分别为「今天/N 天后/更久」。
4. 导出 zip → 清除站点数据 → 导入 → 数据完整。
5. 断开网络刷新 → 应用仍可打开（Service Worker 生效）。
6. Lighthouse PWA 检查通过「可安装」。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: 今日首页、响应式外壳与安装引导"
```

---

## 后续里程碑

- **M2 能手写**：`InkCanvas`、批注层、作答层、草稿板 → 单独计划
- **M3 能导卷子**：PDF/Word 导入、增强面板 → 单独计划
- **M4 有反馈**：统计、搜索、通知、深色模式 → 单独计划
