/**
 * 统计页演示数据 + 截图。
 *   node scripts/e2e-stats.mjs
 * 直接往 IndexedDB 写一批题目/卡片/复习记录，然后截统计页。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const SHOTS = '.cache/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'zh-CN',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const seeded = await page.evaluate(async () => {
  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('cuotiben');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const db = await open();
  const DAY = 86400000;
  const now = Date.now();
  const chapters = [
    ['chap-1-7', 'sub-1', '行列式'],
    ['chap-1-8', 'sub-1', '矩阵'],
    ['chap-1-9', 'sub-1', '向量'],
    ['chap-1-10', 'sub-1', '线性方程组'],
    ['chap-4-1', 'sub-4', '自动控制的一般概念'],
    ['chap-4-2', 'sub-4', '控制系统的数学模型'],
    ['chap-4-3', 'sub-4', '线性系统的时域分析法'],
    ['chap-4-9', 'sub-4', '过程检测及控制仪表'],
  ];

  const problems = [];
  const cards = [];
  const reviewLogs = [];
  let seed = 20261019;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  chapters.forEach(([chapterId, subjectId], ci) => {
    const count = 2 + (ci % 3);
    for (let i = 0; i < count; i++) {
      const id = `demo-p-${ci}-${i}`;
      const archived = rnd() < 0.15;
      const stability = 1 + rnd() * 24;
      const lastReview = now - Math.floor(rnd() * 20) * DAY;
      const due = archived
        ? now + 400 * DAY
        : lastReview + Math.max(1, Math.round(stability)) * DAY;
      problems.push({
        id,
        subjectId,
        chapterId,
        topicIds: [],
        stemAssetId: 'missing',
        answerAssetIds: [],
        wrongNote: '演示数据',
        difficulty: 1 + Math.floor(rnd() * 5),
        createdAt: now - Math.floor(rnd() * 60) * DAY,
        updatedAt: now,
        archivedAt: archived ? now - DAY : undefined,
      });
      cards.push({
        problemId: id,
        due,
        stability,
        difficulty: 4 + rnd() * 4,
        elapsedDays: 0,
        scheduledDays: Math.max(1, Math.round(stability)),
        reps: 1 + Math.floor(rnd() * 5),
        lapses: Math.floor(rnd() * 2),
        state: archived ? 2 : 1 + Math.floor(rnd() * 3),
        lastReview,
        learningSteps: 0,
      });
      const reps = 1 + Math.floor(rnd() * 4);
      for (let r = 0; r < reps; r++) {
        reviewLogs.push({
          id: `demo-l-${ci}-${i}-${r}`,
          problemId: id,
          rating: 1 + Math.floor(rnd() * 4),
          reviewedAt: now - Math.floor(rnd() * 100) * DAY - Math.floor(rnd() * 8) * 3600000,
          durationMs: 20000 + Math.floor(rnd() * 60000),
          prevDue: 0,
          nextDue: 0,
          prevState: 0,
          nextState: 2,
        });
      }
    }
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['problems', 'cards', 'reviewLogs'], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    problems.forEach((p) => tx.objectStore('problems').put(p));
    cards.forEach((c) => tx.objectStore('cards').put(c));
    reviewLogs.forEach((l) => tx.objectStore('reviewLogs').put(l));
  });

  return { problems: problems.length, logs: reviewLogs.length };
});
console.log('seeded:', seeded);

// 直接用 IndexedDB 写入不会触发 Dexie 的 liveQuery，刷新一次让页面重新查询
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

await page.goto(BASE + '/#/stats');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SHOTS, '30-stats.png'), fullPage: true });

const heatCells = await page.locator('div[title*="次"]').count();
const bars = await page.locator('section').nth(2).locator('div[style*="height"]').count();
console.log('heat cells:', heatCells, '| forecast bars:', bars);

await page.getByRole('button', { name: '839 自控', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(SHOTS, '31-stats-subject.png'), fullPage: true });

// 点章节 → 跳到错题本并按该章节筛选
await page.getByRole('button', { name: /过程检测及控制仪表/ }).click();
await page.waitForTimeout(900);
const url = page.url();
const rows = await page.locator('a[href*="/problem/"]').count();
console.log('deep link:', url.includes('chapter='), '| filtered rows:', rows);
await page.screenshot({ path: path.join(SHOTS, '33-stats-deeplink.png'), fullPage: true });

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + '/#/stats');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(SHOTS, '32-stats-desktop.png'), fullPage: true });

// 正确率按科目展开到章节
await page.getByTestId('accuracy-subject').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, '34-accuracy-chapters.png'), fullPage: true });

console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
