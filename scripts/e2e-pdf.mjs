/**
 * PDF 截题冒烟测试：用工作区里的 839 真题 PDF 跑一遍。
 *   node scripts/e2e-pdf.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const PDF =
  process.env.PDF_PATH ??
  path.resolve('../考研资料/自控/东北大学839自控真题大观与章节重点指南.pdf');
const SHOTS = '.cache/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
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

await page.goto(BASE + '/#/capture', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.locator('input[type=file]').nth(2).setInputFiles(PDF);
await page.waitForSelector('input[type=number]', { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, '20-pdf-picker.png') });

const pageInput = page.locator('input[type=number]');
await pageInput.fill('5');
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOTS, '21-pdf-page5.png') });

await page.getByRole('button', { name: /截取第 5 页/ }).click();
await page.waitForSelector('text=在图片上拖出这道题的区域', { timeout: 30000 });

const box = await page.locator('div[style*="aspect-ratio"]').first().boundingBox();
if (!box) throw new Error('找不到裁剪容器');
await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.05);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.4, { steps: 12 });
await page.mouse.up();
await page.screenshot({ path: path.join(SHOTS, '22-pdf-crop.png') });

await page.getByRole('button', { name: '用这个区域' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: '下一步' }).click();
await page.waitForTimeout(800);
await page.getByPlaceholder(/当时为什么错/).fill('PDF 截题测试：根轨迹渐近线角度算错');
await page.getByRole('button', { name: /保存并加入复习/ }).click();
await page.waitForSelector('text=已保存，明天起会自动排期复习', { timeout: 20000 });
await page.screenshot({ path: path.join(SHOTS, '23-pdf-saved.png') });

console.log('pdf flow ok');
console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
