/**
 * 返回路径：筛选保持、章节位置保持、弹窗重开、删除回来源、深链兜底。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/e2e-nav.mjs
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
  const ch = chapters.find((c) => c.name === '根轨迹分析法');
  const now = Date.now();
  const DAY = 86400000;

  const rows = Array.from({ length: 24 }, (_, i) => ({
    id: `nav-${i}`,
    mastery: (i % 4) + 1,
  }));

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['problems', 'cards', 'reviewLogs'], 'readwrite');
    for (const [i, r] of rows.entries()) {
      tx.objectStore('problems').put({
        id: r.id,
        subjectId: ch.subjectId,
        chapterId: ch.id,
        topicIds: [],
        stemAssetId: 'missing',
        answerAssetIds: [],
        wrongNote: `导航测试 ${i + 1}`,
        difficulty: 3,
        mastery: r.mastery,
        weight: 4,
        errorTags: [],
        createdAt: now - i * 60000,
        updatedAt: now,
      });
      tx.objectStore('cards').put({
        problemId: r.id,
        due: now - DAY,
        stability: 3,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 2,
        learningSteps: 0,
        lastReview: now - DAY,
      });
      tx.objectStore('reviewLogs').put({
        id: `nav-log-${i}`,
        problemId: r.id,
        rating: 3,
        reviewedAt: now - 3600000,
        durationMs: 30000,
        prevDue: now - DAY,
        nextDue: now,
        prevState: 2,
        nextState: 2,
      });
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return { chapterId: ch.id, count: rows.length };
});
console.log('seeded:', seeded);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// ---- 1. 检索页：筛选 → 详情 → 返回 ----
await page.goto(BASE + '/#/search');
await page.waitForTimeout(800);
await page.getByTestId('quick-key-only').click();
await page.waitForTimeout(500);
const filtered = await page.locator('a[href*="/problem/"]').count();
check('重点关注筛出部分题', filtered > 0 && filtered < seeded.count, String(filtered));
await page.evaluate(() => window.scrollTo({ top: 400 }));
await page.waitForTimeout(300);

await page.locator('a[href*="/problem/"]').nth(4).click();
await page.waitForTimeout(800);
check('进入详情', page.url().includes('/problem/'));

await page.getByRole('button', { name: '返回上一页' }).click();
await page.waitForTimeout(900);
check('返回后仍在检索页', page.url().includes('/search'), page.url());
check('筛选条件还在 URL 里', page.url().includes('mastery='), page.url());
check(
  '返回后列表数量一致',
  (await page.locator('a[href*="/problem/"]').count()) === filtered
);
const scrollAfter = await page.evaluate(() => window.scrollY);
check('滚动位置已恢复', scrollAfter > 200, String(scrollAfter));
await page.screenshot({ path: path.join(SHOTS, '90-nav-search-back.png') });

// ---- 2. 章节页：滑到第 2 张 → 详情 → 返回 ----
await page.goto(BASE + '/#/chapter/' + seeded.chapterId);
await page.waitForTimeout(900);
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="chapter-scroller"]');
  if (el) el.scrollTo({ left: el.clientWidth, behavior: 'instant' });
});
await page.waitForTimeout(800);
const urlAfterSwipe = page.url();
check('滑动后 URL 记住第 2 张', urlAfterSwipe.includes('i=1'), urlAfterSwipe);

await page.locator('article').nth(1).locator('button').first().click();
await page.waitForTimeout(800);
check('从章节进入详情', page.url().includes('/problem/'));

await page.getByRole('button', { name: '返回上一页' }).click();
await page.waitForTimeout(1000);
check('返回后仍在章节页', page.url().includes('/chapter/'), page.url());
check('章节位置仍是第 2 张', page.url().includes('i=1'), page.url());
const scrolled = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="chapter-scroller"]');
  return el ? Math.round(el.scrollLeft / el.clientWidth) : -1;
});
check('实际停在第 2 张', scrolled === 1, String(scrolled));

// ---- 3. 首页「今日已写」弹窗 → 详情 → 返回 ----
await page.goto(BASE + '/#/');
await page.waitForTimeout(900);
await page.getByRole('button', { name: /今日已写/ }).click();
await page.waitForTimeout(500);
check('弹窗打开', (await page.getByRole('dialog').count()) > 0);
await page.getByRole('dialog').locator('button').filter({ hasText: '根轨迹' }).first().click();
await page.waitForTimeout(900);
check('从弹窗进入详情', page.url().includes('/problem/'));

await page.getByRole('button', { name: '返回上一页' }).click();
await page.waitForTimeout(900);
check('返回后弹窗自动重开', (await page.getByRole('dialog').count()) > 0, page.url());
await page.screenshot({ path: path.join(SHOTS, '91-nav-dialog-back.png') });
await page.keyboard.press('Escape');

// ---- 4. 删除后回到来源列表 ----
await page.goto(BASE + '/#/search');
await page.waitForTimeout(800);
const beforeDelete = await page.locator('a[href*="/problem/"]').count();
await page.locator('a[href*="/problem/"]').first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /删除/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
await page.waitForTimeout(1200);
check('删除后回到检索页', page.url().includes('/search'), page.url());
const afterDelete = await page.locator('a[href*="/problem/"]').count();
check('列表少了一条', afterDelete === beforeDelete - 1, `${beforeDelete} → ${afterDelete}`);

// ---- 5. 深链直接打开详情 → 返回落到章节页 ----
const deepId = `nav-23`;
await page.goto(BASE + '/#/problem/' + deepId);
await page.waitForTimeout(900);
await page.getByRole('button', { name: '返回上一页' }).click();
await page.waitForTimeout(1000);
check('深链返回不跳首页', page.url().includes('/chapter/') || page.url().includes('/search'), page.url());

console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
