/**
 * 掌握程度：分级 → 错题本色条/徽标 → 筛选（含「重点关注」快捷）→ 详情页改级。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/e2e-mastery.mjs
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
  const ch = chapters.find((c) => c.name === '根轨迹分析法');
  const now = Date.now();
  const DAY = 86400000;

  const rows = [
    { id: 'm-none', note: '还没分级', mastery: undefined },
    { id: 'm-hard', note: '完全不会的题', mastery: 1 },
    { id: 'm-ok', note: '已经掌握的题', mastery: 4 },
  ];

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['problems', 'cards'], 'readwrite');
    for (const [i, r] of rows.entries()) {
      tx.objectStore('problems').put({
        id: r.id,
        subjectId: ch.subjectId,
        chapterId: ch.id,
        topicIds: [],
        stemAssetId: 'missing',
        answerAssetIds: [],
        wrongNote: r.note,
        difficulty: 3,
        mastery: r.mastery,
        createdAt: now - i * DAY,
        updatedAt: now,
      });
      tx.objectStore('cards').put({
        problemId: r.id,
        due: now - DAY,
        stability: 3,
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
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.goto(BASE + '/#/library');
await page.waitForTimeout(1000);

const rows = () => page.locator('a[href*="/problem/"]').count();
check('默认列出 3 道', (await rows()) === 3, String(await rows()));

const badges = await page.locator('a[href*="/problem/"]').allInnerTexts();
check('重点不熟标记出现', badges.some((t) => t.includes('重点·不会')));
check('掌握徽标出现', badges.some((t) => t.includes('掌握')));

await page.screenshot({ path: path.join(SHOTS, '60-mastery-library.png'), fullPage: true });

// 快捷筛选：重点关注
await page.getByTestId('quick-key-only').click();
await page.waitForTimeout(600);
check('重点关注只剩 1 道', (await rows()) === 1, String(await rows()));
await page.getByTestId('quick-key-only').click();
await page.waitForTimeout(500);
check('再点一次恢复 3 道', (await rows()) === 3, String(await rows()));

// 筛选面板：掌握程度 = 未分级
await page.getByRole('button', { name: /^筛选/ }).click();
await page.waitForTimeout(500);
const dlg = page.getByRole('dialog');
check('筛选面板有掌握程度', (await dlg.getByText('掌握程度').count()) > 0);
await dlg.getByRole('button', { name: '未分级' }).click();
await page.getByRole('button', { name: '应用' }).click();
await page.waitForTimeout(800);
check('未分级筛出 1 道', (await rows()) === 1, String(await rows()));
await page.screenshot({ path: path.join(SHOTS, '61-mastery-filter.png'), fullPage: true });

// 清空筛选后进详情改级别
await page.getByRole('button', { name: /筛选/ }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: '重置' }).click();
await page.getByRole('button', { name: '应用' }).click();
await page.waitForTimeout(700);

await page.locator('a[href*="/problem/"]').first().click();
await page.waitForTimeout(900);
check('详情页有掌握程度选择', (await page.getByTestId('mastery-2').count()) > 0);
await page.getByTestId('mastery-2').click();
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(SHOTS, '62-mastery-problem.png'), fullPage: true });

// 回错题本确认落库
await page.goto(BASE + '/#/library');
await page.waitForTimeout(900);
const after = await page.locator('a[href*="/problem/"]').allInnerTexts();
check('改级后出现重点·不熟', after.some((t) => t.includes('重点·不熟')));

console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
