/**
 * 加密备份回路：A 端加密导出 → B 端（全新浏览器配置）导入还原。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/e2e-backup.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const SHOTS = '.cache/shots';
const DL = '.cache/downloads';
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DL, { recursive: true });

const PASSWORD = 'kaoyan-2027';
const errors = [];
const check = (name, ok) => {
  console.log(`${ok ? 'ok' : 'FAIL'} ${name}`);
  if (!ok) errors.push('check: ' + name);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function newContext() {
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
  return { context, page };
}

/** 直接写一条错题（含题干图 + 卡片 + 复习记录），模拟真实使用后的状态 */
async function seedProblem(page) {
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('cuotiben');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const img = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]).buffer;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['assets', 'problems', 'cards'], 'readwrite');
      tx.objectStore('assets').put({
        id: 'bk-asset',
        kind: 'stem',
        data: img,
        width: 10,
        height: 10,
        mime: 'image/png',
        bytes: img.byteLength,
        createdAt: Date.now(),
      });
      tx.objectStore('problems').put({
        id: 'bk-problem',
        subjectId: 'sub-1',
        chapterId: 'chap-1-1',
        topicIds: [],
        stemAssetId: 'bk-asset',
        answerAssetIds: [],
        wrongNote: '加密备份测试题',
        difficulty: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      tx.objectStore('cards').put({
        problemId: 'bk-problem',
        due: Date.now(),
        stability: 2,
        difficulty: 4,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 2,
        learningSteps: 0,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

// ---------- A 端：加密导出 ----------
const a = await newContext();
await a.page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await a.page.waitForTimeout(600);
await seedProblem(a.page);
await a.page.reload({ waitUntil: 'networkidle' });
await a.page.waitForTimeout(500);
check('A 端有 1 道题', (await a.page.locator('text=已存 1 道错题').count()) > 0);

await a.page.getByRole('button', { name: '导出备份' }).click();
await a.page.waitForTimeout(300);
await a.page.screenshot({ path: path.join(SHOTS, '20-export-dialog.png'), fullPage: false });
const pwInputs = a.page.locator('input[type=password]');
await pwInputs.nth(0).fill(PASSWORD);
await pwInputs.nth(1).fill(PASSWORD);

const downloadPromise = a.page.waitForEvent('download', { timeout: 30000 });
await a.page.getByRole('button', { name: '生成备份' }).click();
const download = await downloadPromise;
const file = path.join(DL, download.suggestedFilename());
await download.saveAs(file);

const bytes = fs.readFileSync(file);
check('文件名是 .ctbx', file.endsWith('.ctbx'));
check('魔数是 CTBX', bytes.subarray(0, 4).toString('utf8') === 'CTBX');
check('加密后不是 zip', bytes.subarray(0, 2).toString('utf8') !== 'PK');

await a.context.close();

// ---------- B 端：全新配置导入 ----------
const b = await newContext();
await b.page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await b.page.waitForTimeout(600);
check('B 端初始为空', (await b.page.locator('text=已存 0 道错题').count()) > 0);

await b.page.locator('input[type=file]').setInputFiles(file);
await b.page.waitForTimeout(400);
check('提示输入密码', (await b.page.locator('text=这是一个加密备份').count()) > 0);

await b.page.locator('input[type=password]').fill('wrong-password');
await b.page.getByRole('button', { name: '导入', exact: true }).click();
await b.page.waitForTimeout(1200);
check('错误密码被拒绝', (await b.page.locator('text=密码不对').count()) > 0);
check('仍停留在导入弹窗', (await b.page.locator('text=这是一个加密备份').count()) > 0);

await b.page.locator('input[type=password]').fill(PASSWORD);
await b.page.getByRole('button', { name: '导入', exact: true }).click();
await b.page.waitForTimeout(2000);
check('正确密码导入成功', (await b.page.locator('text=已存 1 道错题').count()) > 0);
await b.page.goto(BASE + '/#/library', { waitUntil: 'networkidle' });
await b.page.waitForTimeout(600);
check('题目内容还原', (await b.page.locator('text=加密备份测试题').count()) > 0);
await b.page.screenshot({ path: path.join(SHOTS, '21-imported.png'), fullPage: true });
await b.page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await b.page.waitForTimeout(400);

// 导入后自检应为通过
await b.page.getByRole('button', { name: '检查数据完整性' }).click();
await b.page.waitForTimeout(800);
check('自检通过', (await b.page.locator('text=引用完整').count()) > 0);

console.log('errors:', JSON.stringify(errors));
await b.context.close();
await browser.close();
process.exit(errors.length ? 1 : 0);
