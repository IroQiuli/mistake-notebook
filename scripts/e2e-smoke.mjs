/**
 * M1 冒烟测试：录题 → 首页 → 错题本 → 复习评分。
 * 用本机 Edge 跑（无需下载 Chromium）：
 *   node scripts/e2e-smoke.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const SHOTS = '.cache/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const shots = [];

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
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
});

async function shot(name, fullPage = true) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file, fullPage });
  shots.push(file);
}

async function readInks() {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('cuotiben');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('inks', 'readonly');
          const all = tx.objectStore('inks').getAll();
          all.onsuccess = () =>
            resolve(all.result.map((i) => ({ type: i.ownerType, n: i.strokes.length })));
        };
        req.onerror = () => resolve([]);
      })
  );
}

async function drawStroke() {
  const canvas = page.locator('canvas.ink-canvas').first();
  const b = await canvas.boundingBox();
  if (!b) throw new Error('找不到笔迹画布');
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.35, { steps: 8 });
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.3, { steps: 8 });
  await page.mouse.up();
}

// 1. 今日（空状态）
await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('01-today-empty.png');
console.log('today empty ok:', await page.locator('text=还没有错题').count());

// 2. 录入
await page.goto(BASE + '/#/capture');
await page.waitForTimeout(500);
await shot('02-capture-pick.png');

const fileInputs = page.locator('input[type=file]');
await fileInputs.nth(1).setInputFiles('scripts/fixture-question.png');
await page.getByTestId('cropper').waitFor({ state: 'visible', timeout: 15000 });

const box = await page.getByTestId('cropper').boundingBox();
if (!box) throw new Error('找不到裁剪容器');
await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.03);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.52, { steps: 12 });
await page.mouse.up();
await shot('03-crop.png');
await page.getByRole('button', { name: '用这个区域' }).click();
await page.waitForSelector('text=选一下科目和章节，就可以保存了', { timeout: 20000 });
await shot('05-form.png');
await page.getByRole('button', { name: /更多信息/ }).click();
await page.getByPlaceholder(/当时为什么错/).fill('把阻尼比和自然频率搞混了，劳斯表第三行算错');
await page.getByRole('button', { name: /保存并加入复习/ }).click();
await page.waitForSelector('text=已保存，明天起会自动排期复习', { timeout: 15000 });
await shot('06-done.png');

// 新题按掌握程度排到 1~14 天后，这里把卡片提前到今天再测复习流
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('cuotiben');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const now = Date.now();
  await new Promise((res, rej) => {
    const tx = db.transaction('cards', 'readwrite');
    const store = tx.objectStore('cards');
    const all = store.getAll();
    all.onsuccess = () => {
      for (const c of all.result) store.put({ ...c, due: now });
    };
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  db.close();
});

// 3. 今日（有数据）
await page.goto(BASE + '/#/');
await page.waitForTimeout(800);
await shot('07-today-one.png');
console.log('queue badge:', await page.locator('text=道待复习').count());

// 4. 错题本
await page.goto(BASE + '/#/library');
await page.waitForTimeout(700);
await shot('08-library.png');

// 5. 复习：手写作答 + 评分
await page.goto(BASE + '/#/review');
await page.waitForTimeout(1000);
await shot('09-review.png', false);
await shot('09b-review-written.png', false);
await page.getByRole('button', { name: '看答案' }).click();
await page.waitForTimeout(500);
await shot('10-review-revealed.png', false);
await page.getByRole('button', { name: /记得/ }).click();
await page.waitForSelector('text=这一轮复习完了', { timeout: 15000 });
await page.waitForTimeout(900);
await shot('11-review-done.png');

// 6. 详情页（错题本已折叠，改从检索页进）
await page.goto(BASE + '/#/search');
await page.waitForTimeout(700);
await page.locator('a[href*="/problem/"]').first().click();
await page.waitForTimeout(900);

await page.waitForTimeout(900);
await shot('14-problem-annotated.png');

// 6. 详情页：答案默认隐藏 + 点击放大 + 自定义改期
await page.locator('input[type=file]').last().setInputFiles('scripts/fixture-question.png');
await page.getByRole('button', { name: '显示答案' }).waitFor({ timeout: 15000 });
const hiddenHint = await page.locator('text=答案已隐藏').count();
await page.getByRole('button', { name: '显示答案' }).click();
await page.waitForTimeout(400);
await page.locator('img[alt="答案 1"]').click();
await page.waitForTimeout(500);
const answerDialog = await page.getByRole('dialog').count();
await shot('19-answer-zoom.png', false);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.getByRole('button', { name: '改期' }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder('例如 5').fill('5');
await page.getByRole('button', { name: '确定' }).click();
await page.waitForTimeout(700);
const rescheduled = await page.locator('text=5 天后').count();
console.log('answer hidden:', hiddenHint, '| zoom dialog:', answerDialog, '| 5天后:', rescheduled);

// 7. 我的
await page.goto(BASE + '/#/settings');
await page.waitForTimeout(700);
await shot('12-settings.png');

// 8. 桌面宽度
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + '/#/library');
await page.waitForTimeout(700);
await shot('13-library-desktop.png');

// 9. 筛选面板（科目树，桌面）—— 错题本已折叠，筛选在检索页
await page.goto(BASE + '/#/search');
await page.waitForTimeout(700);
await page.getByRole('button', { name: '筛选', exact: true }).click();
await page.waitForTimeout(500);
const filterDialog = page.getByRole('dialog');
await filterDialog.getByRole('button', { name: /839/ }).click();
await page.waitForTimeout(400);
await shot('17-filter-tree.png');
await page.keyboard.press('Escape');

// 10. 统计（手机）
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/#/stats');
await page.waitForTimeout(1200);
await shot('18-stats.png');
console.log('stats heat cells:', await page.locator('div[title*="次"]').count());

console.log('shots:', shots.length);
console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
