/**
 * 生成 README 用的演示数据与截图（不参与断言，只出图）。
 *   BASE_URL=http://127.0.0.1:5199 node scripts/shots-demo.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const OUT = '.cache/shots';
fs.mkdirSync(OUT, { recursive: true });

const stemBytes = Array.from(fs.readFileSync('scripts/fixture-question.png'));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  locale: 'zh-CN',
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));

await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const seeded = await page.evaluate(async (stem) => {
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
  const subjects = await readAll('subjects');
  const byName = new Map(chapters.map((c) => [c.name, c]));
  const math = subjects.find((s) => s.name === '数学二');
  const acc = subjects.find((s) => s.name.includes('839'));
  const eng = subjects.find((s) => s.name.includes('英语'));
  const pol = subjects.find((s) => s.name.includes('政治'));

  const bin = new Uint8Array(stem);
  const now = Date.now();
  const DAY = 86400000;

  const asset = {
    id: 'demo-stem',
    kind: 'stem',
    data: bin.buffer,
    width: 1200,
    height: 1600,
    mime: 'image/png',
    bytes: bin.length,
    createdAt: now,
  };

  const plan = [
    [math, ['函数、极限与连续', '一元函数微分学', '一元函数积分学', '多元函数微分学', '二重积分']],
    [acc, ['控制系统的数学模型', '线性系统的时域分析法', '根轨迹分析法', '线性系统的频域分析法', '非线性控制系统分析', '线性离散控制系统', '过程检测及控制仪表', '复杂过程控制系统方案设计']],
    [eng, ['阅读理解', '写作']],
    [pol, ['马克思主义基本原理', '毛泽东思想和中国特色社会主义理论体系概论']],
  ];

  const tags = ['概念不清', '计算失误', '审题看漏', '公式记错', '方法没想到'];
  const problems = [];
  const cards = [];
  const logs = [];
  let seed = 20261019;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (const [subject, names] of plan) {
    for (const name of names) {
      const ch = byName.get(name);
      const count = subject === acc ? 2 : 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < count; i++) {
        const id = `demo-${ch.id}-${i}`;
        const archived = rnd() < 0.18;
        const stability = 1 + rnd() * 20;
        const dueOffset = rnd() < 0.55 ? -Math.floor(rnd() * 3) : Math.floor(rnd() * 9);
        problems.push({
          id,
          subjectId: ch.subjectId,
          chapterId: ch.id,
          topicIds: [],
          stemAssetId: 'demo-stem',
          answerAssetIds: ['demo-stem'],
          wrongNote: `${name} 第 ${i + 1} 题：${['符号看错', '公式记混', '计算跳步', '审题漏条件'][Math.floor(rnd() * 4)]}`,
          difficulty: 2 + Math.floor(rnd() * 3),
          sourceKind: rnd() < 0.4 ? '真题' : undefined,
          sourceYear: rnd() < 0.4 ? 2018 + Math.floor(rnd() * 6) : undefined,
          sourcePaper: rnd() < 0.3 ? '2023 真题' : undefined,
          errorTags: [tags[Math.floor(rnd() * tags.length)]],
          // 大部分题有掌握程度，少量留给「未分级」
          mastery: rnd() < 0.85 ? 1 + Math.floor(rnd() * 4) : undefined,
          createdAt: now - Math.floor(rnd() * 40) * DAY,
          updatedAt: now,
          archivedAt: archived ? now - DAY : undefined,
        });
        cards.push({
          problemId: id,
          due: now + dueOffset * DAY,
          stability,
          difficulty: 5,
          elapsedDays: 1,
          scheduledDays: 2,
          reps: 1 + Math.floor(rnd() * 3),
          lapses: 0,
          state: 2,
          learningSteps: 0,
          lastReview: now - Math.floor(rnd() * 10) * DAY,
        });

        // 过去 14 天的复习记录
        for (let d = 0; d < 14; d++) {
          if (rnd() < 0.45) {
            const rating = 1 + Math.floor(rnd() * 4);
            logs.push({
              id: `demo-log-${id}-${d}`,
              problemId: id,
              rating,
              reviewedAt: now - d * DAY - Math.floor(rnd() * 6) * 3600000,
              durationMs: 40000,
              prevDue: now - (d + 1) * DAY,
              nextDue: now - d * DAY,
              prevState: 2,
              nextState: 2,
            });
          }
        }
      }
    }
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['assets', 'problems', 'cards', 'reviewLogs', 'settings'],
      'readwrite'
    );
    tx.objectStore('assets').put(asset);
    problems.forEach((p) => tx.objectStore('problems').put(p));
    cards.forEach((c) => tx.objectStore('cards').put(c));
    logs.forEach((l) => tx.objectStore('reviewLogs').put(l));
    tx.objectStore('settings').put({ key: 'subjectGoals', value: { [math.id]: 6, [acc.id]: 4, [eng.id]: 4, [pol.id]: 4 } });
    tx.objectStore('settings').put({ key: 'lastBackupAt', value: now - 2 * DAY });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return { problems: problems.length, logs: logs.length };
}, stemBytes);
console.log('seeded:', seeded);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'doc-today.png'), fullPage: true });

await page.getByRole('button', { name: /近 7 天/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'doc-week.png') });
await page.getByRole('button', { name: '关闭' }).click();

await page.goto(BASE + '/#/paper');
await page.waitForTimeout(900);
// 只留 839，展示八道大题的卷型
for (const name of [/数学二/, /英语二/, /政治/]) {
  await page.getByRole('button', { name }).first().click();
  await page.waitForTimeout(250);
}
await page.screenshot({ path: path.join(OUT, 'doc-paper.png'), fullPage: true });

await page.getByRole('button', { name: /开始做这套卷/ }).click();
await page.waitForTimeout(1400);
await page.getByRole('button', { name: '看答案' }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'doc-paper-review.png') });

await page.goto(BASE + '/#/stats');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'doc-stats.png'), fullPage: true });

// 图表视图
await page.getByTestId('stats-view-charts').click();
await page.waitForTimeout(400);
await page.getByTestId('chart-mastery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'doc-chart-mastery.png'), fullPage: true });

// 深入分析视图
await page.getByTestId('stats-view-deep').click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'doc-stats-deep.png'), fullPage: true });

await page.goto(BASE + '/#/settings');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'doc-goals.png'), fullPage: true });

// 错题本目录（科目 → 章节折叠）
await page.goto(BASE + '/#/library');
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'doc-library.png'), fullPage: true });

// 章节页：左右滑动
const chapterId = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('cuotiben');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const list = await new Promise((res, rej) => {
    const tx = db.transaction('chapters', 'readonly');
    const r = tx.objectStore('chapters').getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const probs = await new Promise((res, rej) => {
    const tx = db.transaction('problems', 'readonly');
    const r = tx.objectStore('problems').getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const count = new Map();
  probs.filter((p) => !p.archivedAt).forEach((p) => count.set(p.chapterId, (count.get(p.chapterId) ?? 0) + 1));
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  db.close();
  return best ? best[0] : list[0].id;
});
await page.goto(BASE + '/#/chapter/' + chapterId);
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, 'doc-chapter.png'), fullPage: false });

// 筛选手感：掌握程度分组
await page.goto(BASE + '/#/search');
await page.waitForTimeout(800);
await page.getByRole('button', { name: '筛选', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'doc-filter-mastery.png') });
await page.getByRole('button', { name: '应用' }).click();
await page.waitForTimeout(400);

// 题目详情：掌握程度选择条
const firstRow = page.locator('a[href*="/problem/"]').first();
await firstRow.click();
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'doc-problem-mastery.png'), fullPage: true });

await browser.close();
console.log('shots written to', OUT);
