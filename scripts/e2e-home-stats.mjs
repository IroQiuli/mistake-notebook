/**
 * 首页今日计划 + 接下来 3 天 + 统计图表切换与导出。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/e2e-home-stats.mjs
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

await page.evaluate(async () => {
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
  const math = chapters.find((c) => c.name === '函数、极限与连续');
  const acc = chapters.find((c) => c.name === '根轨迹分析法');
  const now = Date.now();
  const DAY = 86400000;

  const rows = [
    ...[0, 1, 2].map((i) => ({ id: `hs-m-${i}`, ch: math, i })),
    ...[0, 1, 2].map((i) => ({ id: `hs-a-${i}`, ch: acc, i })),
    { id: `hs-f-1`, ch: math, i: 9, off: 1 },
    { id: `hs-f-2`, ch: acc, i: 9, off: 2 },
    { id: `hs-f-3`, ch: math, i: 9, off: 3 },
  ];

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['problems', 'cards', 'reviewLogs', 'settings'], 'readwrite');
    for (const r of rows) {
      tx.objectStore('problems').put({
        id: r.id,
        subjectId: r.ch.subjectId,
        chapterId: r.ch.id,
        topicIds: [],
        stemAssetId: 'missing',
        answerAssetIds: [],
        wrongNote: r.id,
        difficulty: 3,
        mastery: 1 + (r.i % 4),
        errorTags: ['计算失误'],
        createdAt: now - r.i * DAY,
        updatedAt: now,
      });
      tx.objectStore('cards').put({
        problemId: r.id,
        due: now + (r.off ?? -1) * DAY,
        stability: 3,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 2,
        lapses: 0,
        state: 2,
        learningSteps: 0,
        lastReview: now - 3 * DAY,
      });
    }
    for (let d = 0; d < 10; d++) {
      tx.objectStore('reviewLogs').put({
        id: `hs-log-${d}`,
        problemId: 'hs-m-0',
        rating: 3,
        reviewedAt: now - d * DAY,
        durationMs: 30000,
        prevDue: now - (d + 1) * DAY,
        nextDue: now - d * DAY,
        prevState: 2,
        nextState: 2,
      });
    }
    tx.objectStore('settings').put({
      key: 'subjectGoals',
      value: { [math.subjectId]: 2, [acc.subjectId]: 2 },
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// ---- 首页 ----
const body = await page.locator('body').innerText();
check('导航改成首页', body.includes('首页'));
check('标题是「今天要写的」', body.includes('今天要写的'));

const count = Number(await page.getByTestId('queue-count').innerText());
check('只显示今天计划内（2+2=4）', count === 4, `实际 ${count}`);
check('提示顺延数量', body.includes('另有 2 道到期'));
check('接下来 3 天', body.includes('接下来 3 天') && body.includes('后天') && body.includes('3 天后'));
await page.screenshot({ path: path.join(SHOTS, '70-home-plan.png'), fullPage: true });

// ---- 统计图表 ----
await page.goto(BASE + '/#/stats');
await page.waitForTimeout(1200);

for (const key of ['trend', 'accuracy', 'tags', 'mastery', 'volume']) {
  await page.getByTestId(`chart-${key}`).click();
  await page.waitForTimeout(350);
  const svgs = await page.locator('section', { hasText: '统计图表' }).locator('svg').count();
  check(`图表 ${key} 渲染`, svgs > 0, `svg=${svgs}`);
}

// 导出 PNG
await page.getByTestId('chart-mastery').click();
await page.waitForTimeout(300);
const pngPromise = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: 'PNG' }).click();
const png = await pngPromise;
check('导出 PNG', png.suggestedFilename().endsWith('.png'), png.suggestedFilename());
const pngPath = path.join('.cache/downloads', png.suggestedFilename());
fs.mkdirSync('.cache/downloads', { recursive: true });
await png.saveAs(pngPath);
check('PNG 不是空文件', fs.statSync(pngPath).size > 1000, String(fs.statSync(pngPath).size));

// 导出 CSV
const csvPromise = page.waitForEvent('download', { timeout: 20000 });
await page.getByRole('button', { name: 'CSV' }).click();
const csv = await csvPromise;
check('导出 CSV', csv.suggestedFilename().endsWith('.csv'), csv.suggestedFilename());
const csvPath = path.join('.cache/downloads', csv.suggestedFilename());
await csv.saveAs(csvPath);
const csvText = fs.readFileSync(csvPath, 'utf8');
check('CSV 有表头和数据', csvText.includes('掌握程度') && csvText.includes('完全不会'));

await page.screenshot({ path: path.join(SHOTS, '71-stats-charts.png'), fullPage: true });

console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
