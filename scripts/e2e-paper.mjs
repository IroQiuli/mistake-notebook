/**
 * 每科题量 + 首页卡片细看 + 套卷组卷全流程。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/e2e-paper.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const SHOTS = '.cache/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`);
  if (!ok) errors.push('check: ' + name);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'zh-CN',
  acceptDownloads: true,
});
const page = await context.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const seeded = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('cuotiben');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const readAll = (store) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });

  const chapters = await readAll('chapters');
  const byName = new Map(chapters.map((c) => [c.name, c]));
  const now = Date.now();
  const DAY = 86400000;

  const slots = [
    '控制系统的数学模型',
    '线性系统的时域分析法',
    '根轨迹分析法',
    '线性系统的频域分析法',
    '非线性控制系统分析',
    '线性离散控制系统',
    '过程检测及控制仪表',
    '复杂过程控制系统方案设计',
  ];

  const problems = [];
  const cards = [];
  const logs = [];

  slots.forEach((name, i) => {
    const ch = byName.get(name);
    const id = `paper-839-${i}`;
    problems.push({
      id,
      subjectId: ch.subjectId,
      chapterId: ch.id,
      topicIds: [],
      stemAssetId: 'missing',
      answerAssetIds: [],
      wrongNote: `839 第 ${i + 1} 题`,
      difficulty: 3,
      createdAt: now - (i + 1) * DAY,
      updatedAt: now,
    });
    cards.push({
      problemId: id,
      due: now - DAY,
      stability: 3 + i,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 2,
      lapses: 0,
      state: 2,
      learningSteps: 0,
      lastReview: now - 2 * DAY,
    });
  });

  const mathCh = byName.get('函数、极限与连续');
  for (let i = 0; i < 6; i++) {
    const id = `paper-math-${i}`;
    problems.push({
      id,
      subjectId: mathCh.subjectId,
      chapterId: mathCh.id,
      topicIds: [],
      stemAssetId: 'missing',
      answerAssetIds: [],
      wrongNote: `数学第 ${i + 1} 题`,
      difficulty: 3,
      createdAt: now - (i + 1) * DAY,
      updatedAt: now,
    });
    cards.push({
      problemId: id,
      due: now - DAY,
      stability: 6,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 2,
      lapses: 0,
      state: 2,
      learningSteps: 0,
      lastReview: now - 2 * DAY,
    });
  }

  logs.push({
    id: 'paper-log-1',
    problemId: 'paper-math-0',
    rating: 3,
    reviewedAt: now - 3600_000,
    durationMs: 30000,
    prevDue: now - DAY,
    nextDue: now + DAY,
    prevState: 2,
    nextState: 2,
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['problems', 'cards', 'reviewLogs', 'settings'], 'readwrite');
    problems.forEach((p) => tx.objectStore('problems').put(p));
    cards.forEach((c) => tx.objectStore('cards').put(c));
    logs.forEach((l) => tx.objectStore('reviewLogs').put(l));
    // 数学 2 道、839 3 道
    tx.objectStore('settings').put({
      key: 'subjectGoals',
      value: { [mathCh.subjectId]: 2, [chapters.find((c) => c.name === slots[0]).subjectId]: 3 },
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return { problems: problems.length, mathSubject: mathCh.subjectId };
});
console.log('seeded:', seeded);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// ---- 每科题量 ----
const queueCount = Number(await page.getByTestId('queue-count').innerText());
check('每科题量生效（2 + 3 = 5）', queueCount === 5, `实际 ${queueCount}`);
const bodyText = await page.locator('body').innerText();
check(
  '首页显示每科进度',
  /数学二[\s\S]*?1\/2/.test(bodyText) && /839[\s\S]*?0\/3/.test(bodyText)
);
await page.screenshot({ path: path.join(SHOTS, '40-today-quota.png'), fullPage: true });

// ---- 首页卡片点开细看 ----
await page.getByRole('button', { name: /今日已写/ }).click();
await page.waitForTimeout(400);
check('今日已写弹窗', (await page.getByRole('dialog').getByText('复习过的题').count()) > 0);
check('弹窗里有逐题记录', (await page.getByRole('dialog').getByText('函数、极限与连续').count()) > 0);
await page.screenshot({ path: path.join(SHOTS, '41-today-detail.png') });
await page.getByRole('button', { name: '关闭' }).click();
await page.waitForTimeout(300);

await page.getByRole('button', { name: /近 7 天/ }).click();
await page.waitForTimeout(400);
check('近 7 天有柱状图', (await page.getByRole('dialog').getByText('次复习').count()) > 0);
await page.screenshot({ path: path.join(SHOTS, '42-week-detail.png') });
await page.getByRole('button', { name: '关闭' }).click();
await page.waitForTimeout(300);

// ---- 套卷 ----
await page.goto(BASE + '/#/paper');
await page.waitForTimeout(900);
check('组卷页打开', (await page.locator('text=卷面预览').count()) > 0);

// 点掉数学二，只留 839
await page.getByRole('button', { name: /数学二/ }).first().click();
await page.waitForTimeout(500);
const previewText = await page.locator('body').innerText();
check('839 按八道大题排', previewText.includes('第 1 题') && previewText.includes('第 8 题'));
await page.screenshot({ path: path.join(SHOTS, '43-paper-config.png'), fullPage: true });

await page.getByRole('button', { name: /开始做这套卷/ }).click();
await page.waitForTimeout(1200);
const reviewText = await page.locator('body').innerText();
check('进入套卷模式', reviewText.includes('套卷'));
check('套卷进度 1 / 8', /1 \/ 8/.test(reviewText), reviewText.slice(0, 60));

await page.getByRole('button', { name: '看答案' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, '44-paper-review.png') });
await page.getByRole('button', { name: /记得/ }).click();
await page.waitForTimeout(900);
const afterText = await page.locator('body').innerText();
check('评分后进入第 2 题', /2 \/ 8/.test(afterText));

console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
