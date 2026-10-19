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
await page.waitForSelector('text=在图片上拖出这道题的区域', { timeout: 15000 });

const box = await page.locator('div[style*="aspect-ratio"]').first().boundingBox();
if (!box) throw new Error('找不到裁剪容器');
await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.03);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.52, { steps: 12 });
await page.mouse.up();
await shot('03-crop.png');
await page.getByRole('button', { name: '用这个区域' }).click();
await page.waitForTimeout(800);
await shot('04-enhance.png');
await page.getByRole('button', { name: '下一步' }).click();
await page.waitForTimeout(800);
await shot('05-form.png');

await page.getByPlaceholder(/当时为什么错/).fill('把阻尼比和自然频率搞混了，劳斯表第三行算错');
await page.getByRole('button', { name: /保存并加入复习/ }).click();
await page.waitForSelector('text=已保存，明天起会自动排期复习', { timeout: 15000 });
await shot('06-done.png');

// 3. 今日（有数据）
await page.goto(BASE + '/#/');
await page.waitForTimeout(800);
await shot('07-today-one.png');
console.log('queue badge:', await page.locator('text=道待复习').count());

// 4. 错题本
await page.goto(BASE + '/#/library');
await page.waitForTimeout(700);
await shot('08-library.png');

// 5. 复习
await page.goto(BASE + '/#/review');
await page.waitForTimeout(1000);
await shot('09-review.png', false);
await page.getByRole('button', { name: '看答案' }).click();
await page.waitForTimeout(500);
await shot('10-review-revealed.png', false);
await page.getByRole('button', { name: /记得/ }).click();
await page.waitForSelector('text=这一轮复习完了', { timeout: 15000 });
await shot('11-review-done.png');

// 6. 我的
await page.goto(BASE + '/#/settings');
await page.waitForTimeout(700);
await shot('12-settings.png');

// 7. 桌面宽度
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + '/#/library');
await page.waitForTimeout(700);
await shot('13-library-desktop.png');

console.log('shots:', shots.length);
console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
