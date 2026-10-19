# 错题簿（cuotiben）设计规格

- 版本：v1.0
- 日期：2026-10-19
- 状态：已确认
- 项目目录：`D:\浏览器下载用\学习\cuotiben`
- 产品名：错题簿（显示名）／`cuotiben`（工程名）

---

## 1. 背景与目标

用户备战考研（东北大学 839 自动控制原理及过程控制 + 数学二 + 英语二 + 政治），错题散落在纸质卷子、PDF 真题、讲义截图和相册里。需要一个能随手收集、自动安排复习、并且能在平板上用触屏笔直接书写的工具。

**目标**

1. 一道错题从「拍照」到「入库并进入今日复习队列」在 20 秒内完成。
2. 复习由算法自动排期，用户不需要自己记「该复习哪道题」。
3. 平板端可以用触屏笔在题目原图上圈画、写步骤，笔迹可保留、可重编辑。
4. 手机、平板、电脑通过同一个网址访问同一套界面，数据各自本地保存并可互相迁移。
5. 断网可用；数据可完整导出与恢复。

**非目标（v1 明确不做）**

- OCR / 公式识别 / 自动判题
- 云端账号、多端自动同步、多人协作、社区分享
- AI 生成解析或推荐相似题
- 原生 App（iOS / Android 安装包）
- 错题打印排版、导出 Word/PDF 练习卷（v1 之后再说）
- 选择题题库、在线做题

---

## 2. 用户与场景

**唯一用户**：考研备考生本人（单机单账号，无登录）。

### 场景 A：做完一套真题，集中录入

桌面上摊着 2023 年 839 真题，错了 4 题。打开平板 → 连拍 4 张 → 每张框选一道题 → 科目自动记忆为「839」→ 章节选「3 线性系统的时域分析法」→ 难度 4 → 来源「2023 真题 第 2 题」→ 存完继续。全程约 3 分钟。

### 场景 B：用 PDF 截题

笔记本上打开 `839自动控制原理及过程控制.pdf`，跳到第 40 页，框选第 3 题。系统以 3 倍分辨率渲染该页并裁出选区，得到清晰题干。

### 场景 C：每天的复习

晚上 10 点打开首页，看到「今日待复习 12 题（数学 7 / 839 5）」。点开始 → 只看到题目图，笔迹隐藏 → 在图上写关键步骤 → 点「看答案」→ 对照当时的错误原因 → 自评「记得」→ 下一题。12 题约 25 分钟。

### 场景 D：睡前复盘薄弱章节

打开统计页，看到「根轨迹」掌握度最低、未来 3 天有 8 题到期、本月复习 213 次。点「根轨迹」直接跳到该章节的错题列表。

---

## 3. 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite + React 18 + TypeScript | 静态产物、生态成熟、类型安全 |
| 样式 | Tailwind CSS | 响应式布局快，手机/平板两套断点 |
| 路由 | React Router（HashRouter） | 静态托管无 404 回退问题，可直接部署任意子路径 |
| 存储 | Dexie（IndexedDB 封装） | 支持 Blob、事务、索引、schema 版本迁移 |
| 排期 | ts-fsrs（FSRS-5） | 自适应间隔，比固定艾宾浩斯省时间；纯计算、可单测 |
| PDF | pdfjs-dist | 浏览器内渲染页面到 canvas，无需后端 |
| Word | docx-preview + html2canvas | 渲染 docx 后整页截图，走同一套框选器 |
| 备份 | JSZip | 打包图片与 JSON 为一个 zip |
| PWA | vite-plugin-pwa（Workbox） | 预缓存应用外壳，安装到桌面 |
| 测试 | Vitest + fake-indexeddb + Testing Library | 领域逻辑纯函数优先，可脱离 UI 测 |

**硬性技术约束**

- 笔迹一律使用 **Pointer Events**，不用 Touch Events / Mouse Events 分支。
- 图片二进制存 **Blob**，不存 base64。
- 笔迹坐标一律 **归一化到 0–1**（相对图片显示框），与像素和缩放解耦。
- 所有时间写入用毫秒时间戳；「日期」判定统一走 `dayKey()`，学习日边界为本地时间 **04:00**（凌晨 3 点复习仍算前一天）。

---

## 4. 信息架构

### 4.1 路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `#/` | 今日 | 待复习数、开始按钮、连续天数、备份提醒 |
| `#/review` | 复习会话 | 全屏专注模式，隐藏导航 |
| `#/library` | 错题本 | 筛选 + 卡片网格/列表 |
| `#/problem/:id` | 错题详情 | 大图、批注、历史、改排期 |
| `#/capture` | 录入 | 分步：来源 → 框选 → 增强 → 信息 |
| `#/scratch` | 草稿板 | 独立手写页 |
| `#/stats` | 统计 | 热力图、分布、到期预测 |
| `#/settings` | 设置 | 分类管理、参数、备份、存储占用 |
| `#/onboarding` | 首次引导 | 3 屏：装到桌面、如何录题、如何复习 |

### 4.2 布局

- 手机（< 768px）：单栏 + 底部 Tab（今日 / 错题本 / 录入 / 统计 / 我的）。
- 平板（≥ 768px，横屏优先）：左侧 340px 常驻列表/导航，右侧内容区。
- 复习页与手写页全屏，无 Tab，仅顶部返回与工具条。
- 触控目标最小 44×44px；横竖屏切换不丢画布状态（笔迹以归一化坐标存，重排后重绘）。

### 4.3 今日页内容

1. 顶部：日期 + 连续复习天数 + 待复习总数。
2. 主按钮「开始复习（N）」，下方按科目拆分的小按钮可直接筛单科。
3. 三个数字卡：今日已复习 / 本周复习 / 未掌握错题数。
4. 备份提示条：距上次导出 > 7 天时出现，带「立即备份」。
5. 最近录入的 4 道题（缩略图），点进详情。

---

## 5. 数据模型

### 5.1 表结构

```ts
type ID = string; // crypto.randomUUID()

interface Subject {
  id: ID;
  name: string;          // 数学二 / 英语二 / 政治 / 839
  color: string;         // 用于角标与图表
  order: number;
  archived: 0 | 1;
}

interface Chapter {
  id: ID;
  subjectId: ID;
  name: string;
  order: number;
}

interface Topic {          // 知识点标签，与章节多对多
  id: ID;
  subjectId: ID;
  name: string;
  usageCount: number;    // 冗余计数，用于标签云排序
}

interface Problem {
  id: ID;
  subjectId: ID;
  chapterId: ID;
  topicIds: ID[];

  stemAssetId: ID;        // 题目图片（必填）
  answerAssetIds: ID[];   // 正确答案图片（可 0..n）
  stemInkId?: ID;         // 题目上的批注（单层，可反复编辑）
  wrongNote: string;      // 错误原因（文字，可空）
  wrongInkId?: ID;        // 错误原因（手写，可空）

  difficulty: 1 | 2 | 3 | 4 | 5;
  sourceYear?: number;    // 2023
  sourcePaper?: string;   // "真题" / "李林四套" / "讲义第3章"
  sourceNo?: string;      // "第2题"

  createdAt: number;
  updatedAt: number;
  archivedAt?: number;    // 非空 = 已掌握归档
  missingAsset?: 0 | 1;   // 导入后图片缺失标记
}

interface Card {                    // 一题一卡
  problemId: ID;                    // 主键
  due: number;
  stability: number;
  difficulty: number;               // FSRS 内部难度，与 Problem.difficulty 无关
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;             // New / Learning / Review / Relearning
  lastReview?: number;
  learningSteps: number;
}

interface ReviewLog {
  id: ID;
  problemId: ID;
  rating: 1 | 2 | 3 | 4;            // 忘记/模糊/记得/熟练
  reviewedAt: number;
  durationMs: number;
  prevDue: number;
  nextDue: number;
  prevState: number;
  nextState: number;
}

interface Asset {
  id: ID;
  kind: 'stem' | 'answer' | 'thumb' | 'scratch-export';
  sourceAssetId?: ID;     // 缩略图指向的原图
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  createdAt: number;
}

type Tool = 'pen' | 'highlighter';

interface Stroke {
  id: string;
  tool: Tool;
  color: string;          // hex
  width: number;          // 基准宽度，按图片宽度比例记录
  points: [number, number, number][]; // x, y 归一化 0–1；p 压力 0–1
}

interface Ink {
  id: ID;
  ownerType: 'problem-stem' | 'problem-wrong' | 'attempt' | 'scratch';
  ownerId: ID;            // problem.id 或 scratch.id
  aspect: number;         // width / height，用于还原绘制比例
  strokes: Stroke[];
  createdAt: number;
  updatedAt: number;
}

interface Scratch {       // 草稿页
  id: ID;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface Setting { key: string; value: unknown; }
```

### 5.2 Dexie schema

```js
db.version(1).stores({
  subjects:  'id, order, archived',
  chapters:  'id, subjectId, [subjectId+order]',
  topics:    'id, subjectId, name',
  problems:  'id, subjectId, chapterId, createdAt, archivedAt, *topicIds',
  cards:     'problemId, due, state',
  reviewLogs:'id, problemId, reviewedAt',
  assets:    'id, kind, createdAt',
  inks:      'id, ownerId, ownerType, createdAt',
  scratch:   'id, updatedAt',
  settings:  'key',
});
```

不建外键约束，删除走应用层事务（删除 Problem 时级联删 Card、Ink、ReviewLogs，Asset 用引用计数后清理孤立项）。

### 5.3 约束与默认值

| 规则 | 值 |
|---|---|
| 新题入库 | 立即创建 Card，`due = now`，`state = New` |
| 目标保留率 | 0.90（可调 0.85–0.95） |
| 每日新题上限 | 30（0 = 不限） |
| 归档 | 手动；连续 3 次「熟练」时在复习页提示可归档 |
| 同题最多答案图 | 6 |
| 单张图片长边上限 | 2400px，JPEG q0.85（文字截图可用 PNG） |

---

## 6. 核心流程

### 6.1 录入

```
来源选择 → [拍照 | 相册(多选) | PDF | Word]
        → 方向纠正 → 缩放 → 框选(可多个) → 增强(可选) → 信息表单 → 入库
```

**步骤细节**

1. **拍照**：`<input type="file" accept="image/*" capture="environment">`；相册支持多选，逐张处理。
2. **方向**：`createImageBitmap(blob, { imageOrientation: 'from-image' })`，避免 EXIF 旋转。
3. **框选**：在图片上拖拽矩形，四角可调，可「再框一个」一次产出多题。框选结果是独立 canvas 区域导出 PNG。
4. **增强**：亮度 / 对比度 / 灰度 / 二值化阈值 四个滑杆，实时预览；不改变原始文件，增强结果作为最终图存库。
5. **信息表单**：
   - 科目（默认上次）、章节（下拉 + 可新建）、知识点标签（已有标签可多选，输入即新建）
   - 难度 1–5（默认 3）
   - 来源：年份（数字）、卷子名（自由文本，带历史建议）、题号
   - 错误原因：文字输入 / 切到手写面板 / 两者都可填
6. **保存**：事务内写 Asset、Problem、Ink、Card，更新 topic 的 `usageCount`；成功后提示「已加入今日队列」，提供「继续录下一题」（保留科目/章节/来源）与「查看」。
7. 允许**先存后补**：答案图与错误原因都可以为空，详情页可补。

**异常**

- 图片解码失败 → 提示「这张图打不开，换一张或重拍」，不阻塞其他图片。
- 存储配额超限（`QuotaExceededError`）→ 弹窗说明占用，提供「去清理」入口，本次不写入，表单内容保留。
- 框选区域过小（< 32×32）→ 拒绝并提示。

### 6.2 复习会话

**取题**（`domain/queue.ts`，纯函数）

1. 过滤：`archivedAt == null` 且 `card.due <= endOfDay(now)`（学习日 04:00 边界）。
2. 新题限流：`state === New` 的题按 `createdAt` 升序取前 N（默认 30），其余顺延。
3. 排序：逾期天数降序 → 难度降序 → due 升序。
4. 打散：按科目轮转，避免连续 3 题同章。
5. 会话开始即冻结队列顺序（中途评分不改变本轮顺序），进度写入 `settings.lastSession`，误关页面可续。

**单题界面**

```
┌──────────────────────────────────────┐
│ 3/12  839 · 时域分析法       [退出]   │
├──────────────────────────────────────┤
│                                      │
│         题目图片（双指缩放）           │
│         + 透明笔迹层（默认空）          │
│                                      │
├──────────────────────────────────────┤
│ [笔][荧光][橡皮][撤销]  [草稿板]        │
│ [显示我的旧批注]  [看答案]              │
└──────────────────────────────────────┘
   点「看答案」后，底部替换为四档评分：
   [忘记 1] [模糊 2] [记得 3] [熟练 4]
```

- 初始只显示题干图；`stemInkId` 的旧批注与答案图默认隐藏（防止剧透）。
- 用户的书写写入 **新的 attempt 层**（`ownerType: 'attempt'`），不污染原批注。
- 看答案后展示：答案图（可左右滑）、错误原因文字、历史评分记录（最近 3 次）。
- 快捷键（桌面）：`1/2/3/4` 评分，`空格` 看答案，`Ctrl+Z` 撤销，`Esc` 退出。
- 评分 → 调 FSRS → 写 Card + ReviewLog → 动画过场 → 下一题。
- 会话结束页：本轮题数、用时、各档分布、下次到期时间。

**异常/边界**

- 图片加载失败（`missingAsset`）→ 显示占位卡「图片缺失」，仍可评分或选择「删除此题」。
- 中途退出 → 已评分的保留，未评分的回队列。
- 空队列 → 空状态页：「今天没有到期错题」，给「去录一题」和「随机复习 10 题」两个出口。

### 6.3 排期与手动调整

- 四档映射 FSRS：忘记 = Again，模糊 = Hard，记得 = Good，熟练 = Easy。
- 「忘记」后该题 `lapses + 1`，当日可再次出现（`state = Relearning`）。
- 详情页「重新排期」：今天 / 3 天后 / 7 天后 / 自定义日期，直接改 `due` 并写一条 `rating = 0` 的操作日志（不影响 FSRS 参数）。
- 「提前复习」不影响排期；若在会话中评分，则按正常规则更新。
- 归档：详情页「标记已掌握」→ 设 `archivedAt`，从队列移除；错题本可按「已掌握」筛选，可取消归档。

### 6.4 检索与筛选

筛选维度（全部为「与」关系，内部为「或」）：

- 科目（单选 Tab）/ 章节（多选）/ 知识点标签（多选，交集或并集可切换）
- 难度范围（1–5 多选）
- 状态：全部 / 待复习 / 已逾期 / 新题 / 已掌握
- 来源年份（多选）
- 关键词：模糊匹配 `wrongNote`、`sourcePaper`、`sourceNo`、章节名、标签名

排序：最近录入 / 最早录入 / 最近复习 / 到期时间 / 难度 / 复习次数。

列表项：缩略图 + 科目色条 + 章节 + 标签（最多 2 个 +N）+ 难度星 + 到期状态徽标。列表超过 200 项启用简单窗口化。

### 6.5 备份与恢复

**导出**（`storage/backup.ts`）

```
cuotiben-backup-2026-10-19.zip
├── manifest.json     { format: 1, appVersion, exportedAt, counts, checksum? }
├── data.json         { subjects, chapters, topics, problems, cards, reviewLogs,
│                       inks, scratch, settings }
├── assets/{id}.{ext}
└── README.txt        恢复说明
```

- 导出前把 Asset Blob 读出打包；笔迹在 `data.json` 内。
- 文件名带日期；`settings.lastBackupAt` 更新。
- 桌面端可另提供「只导出 JSON（不含图片）」，用于纯文本迁移。

**导入**

1. 校验 `manifest.format === 1`，版本不匹配则提示仍可尝试。
2. 按 id **upsert**：同 id 覆盖，新 id 插入；不删除本地已有数据。
3. 缺失的 Asset → 该 Problem 标 `missingAsset = 1`。
4. 导入前自动生成一份「导入前快照」（同一套导出逻辑，存内存或临时下载）。
5. 完成后显示统计：新增 / 覆盖 各多少条。

**自动保护**

- 启动时若 `lastBackupAt` 距今 > 7 天，首页显示提醒条。
- 首次启动请求 `navigator.storage.persist()`，失败则记录并提示装在桌面。
- 设置页显示「已用 / 可用配额」（`navigator.storage.estimate()`）。

---

## 7. 手写子系统

### 7.1 坐标系

- 笔迹点存归一化坐标 `(x, y)`，原点为图片显示框左上角，范围 `[0, 1]`。
- `width` 以图片显示宽度的比例记录（如 `0.004`），换算：`px = width * displayWidth`。
- 渲染时按当前显示尺寸重算，所以放大、缩小、换屏幕都不变形。
- `aspect` 记录绘制时的宽高比，用于在无图片的草稿页还原画布比例。

### 7.2 输入与压感

```
pointerdown (pointerType: pen|touch|mouse)
  ├─ pen  → 记录 lastPenAt，开始一笔
  ├─ touch 且 now - lastPenAt < 1000ms → 忽略（掌拒）
  ├─ touch 且双指 → 进入缩放/平移手势，不落笔
  └─ mouse → 允许（桌面调试）
```

- `pointermove` 用 `getCoalescedEvents()` 取全部采样点，逐段绘制。
- 每点记录 `pressure`（无压感设备返回 0.5，则按速度调制：`w = base * clamp(1.2 - v/800, 0.35, 1)`）。
- 线条用二次贝塞尔中点平滑 + `lineCap/lineJoin = 'round'`；荧光笔 `globalCompositeOperation = 'multiply'` 且 `alpha = 0.35`。
- 绘制到 `devicePixelRatio` 缩放的 canvas，避免模糊。
- 单笔结束后做**抽稀**（距离阈值 0.0015 + 压力差阈值），减小存储与重绘开销。

### 7.3 工具

| 工具 | 行为 |
|---|---|
| 笔 | 黑 / 红 / 蓝，三档粗细 |
| 荧光笔 | 黄 / 绿，半透明正片叠底，不参与橡皮默认命中 |
| 橡皮 | 整笔擦除（命中笔画包围盒 + 线段距离判定） |
| 撤销 / 重做 | 基于 strokes 数组的操作栈，上限 50 步 |
| 清空 | 二次确认 |
| 缩放/平移 | 双指；桌面 `Ctrl+滚轮` |

### 7.4 持久化与安全

- 笔迹在 `pointerup` 后 500ms 防抖写入 IndexedDB（只写 strokes 数组，整条 Ink 记录覆盖）。
- 页面 `visibilitychange` 隐藏时立即 flush。
- 写入失败（配额）→ 顶部红条「保存失败：空间不足」，笔迹保留在内存并提示导出。
- 笔迹层默认可隐藏/显示；复习页永远默认隐藏旧批注。

### 7.5 草稿板

- 独立页面，白底/网格/横线三种底纹，单页滚动（不做无限画布，避免性能与导出复杂度）。
- 进入复习页的草稿板时，草稿自动关联当前 `problemId`（存为 `attempt` Ink），可保存为本次复习的解题过程。
- 「导出 PNG」把底纹 + 笔迹合成图片，下载或以「答案图」形式挂到当前错题。
- 草稿列表：按更新时间排序，可重命名、删除。

---

## 8. 图片与文档导入

### 8.1 图片处理管线

```
File → createImageBitmap(from-image) → 长边限制 2400 → OffscreenCanvas 缩放
     → 框选裁剪 → 增强滤镜 → toBlob(JPEG 0.85 或 PNG)
     → 存 Asset(原图) + 生成 400px 缩略图 Asset
```

- 统一转为 `sRGB`，PNG 仅用于纯文字截图（用户可在增强页选「保留清晰文字」）。
- 缩略图用于列表，`kind: 'thumb'`，通过 `sourceAssetId` 指向原图，删除原图时一并清理。

### 8.2 PDF 导入

1. `pdfjs-dist` 加载文件（ArrayBuffer，不 Worker 简化版）、解析页数。
2. 页面缩略图导航；渲染当前页到 canvas（`scale = 3`，上限宽度 2400px）。
3. 复用框选器：可在一页上框多题，每题产出独立图片。
4. 支持页码跳转与「上一页/下一页」；大文件按页懒渲染，避免一次性占内存。

### 8.3 Word 导入

1. `docx-preview` 渲染到离屏容器（宽度固定 900px）。
2. `html2canvas` 整页截图（`scale = 2`）。
3. 复用框选器截取题目区域。
4. 限制：复杂排版（表格跨页、浮动图片、公式域）可能渲染偏差，UI 上注明「建议优先用 PDF」。

### 8.4 增强滤镜

基于 canvas `filter` 与逐像素处理：

- 亮度 `0.7–1.3`、对比度 `0.7–2.0`、灰度开关、二值化阈值 `80–200`、锐化（卷积核）。
- 实时预览用 CSS filter 近似，最终导出走 canvas 精确处理。

---

## 9. 内置分类模板

首次启动写入以下科目与章节（可改名、可增删、可排序）。

### 数学二

**高等数学**：函数、极限与连续 ｜ 一元函数微分学 ｜ 一元函数积分学 ｜ 多元函数微分学 ｜ 二重积分 ｜ 常微分方程

**线性代数**：行列式 ｜ 矩阵 ｜ 向量 ｜ 线性方程组 ｜ 特征值与特征向量 ｜ 二次型

### 英语二

完形填空 ｜ 阅读理解 ｜ 新题型 ｜ 翻译 ｜ 写作 ｜ 词汇与语法

### 政治

马克思主义基本原理 ｜ 毛泽东思想和中国特色社会主义理论体系概论 ｜ 中国近现代史纲要 ｜ 思想道德与法治 ｜ 形势与政策

### 839 自动控制原理及过程控制

**自动控制原理（王建辉《自动控制原理》第 2 版）**

1. 自动控制的一般概念
2. 控制系统的数学模型
3. 线性系统的时域分析法
4. 根轨迹分析法
5. 线性系统的频域分析法
6. 线性系统的校正方法
7. 非线性控制系统分析
8. 线性离散控制系统

**过程控制系统（王福利《过程控制系统》第 2 版）**

9. 过程检测及控制仪表
10. 被控过程特性的机理建模
11. 常规过程控制系统（单回路控制）
12. 复杂过程控制系统方案设计
13. 典型工业过程控制综合设计实战

> 科目颜色：数学二 蓝、英语二 绿、政治 红、839 橙。

---

## 10. PWA 与部署

- `vite.config.ts`：`base: './'`，输出 `dist/`。
- `vite-plugin-pwa`：`registerType: 'autoUpdate'`，预缓存 app shell，`manifest` 含 `name / short_name / icons(192,512, maskable) / theme_color / background_color / display: standalone / orientation: any`。
- 图标：用 SVG 生成 512 与 192 PNG，主色橙，图形为「本子 + 对勾」。
- 首页检测 `display-mode: standalone`，非独立模式时顶部提示「添加到主屏幕」。
- 部署目标：GitHub Pages 或 Cloudflare Pages（二选一，文档都写）。仓库内提供 `.github/workflows/deploy.yml`（push main 自动构建发布）与 Cloudflare 的构建命令说明。
- 服务端无任何依赖；不需要数据库、不需要 API。

---

## 11. 错误处理与边界

| 场景 | 处理 |
|---|---|
| 存储配额不足 | 捕获 `QuotaExceededError`，提示占用并引导清理；表单/笔迹不丢失 |
| 图片解码失败 | 单张跳过并提示，不阻塞批次 |
| 数据库版本升级 | Dexie `upgrade` 迁移；迁移前提示「建议先备份」 |
| 备份格式不兼容 | 校验 `format`，给出明确版本号与联系方式 |
| 导入冲突 | 同 id 覆盖；导入前自动快照 |
| 网络离线 | 首次加载后完全离线可用；离线时显示小角标 |
| 多标签页同时写 | 以 IndexedDB 事务为准，`BroadcastChannel` 通知其他页刷新（M4） |
| 时间/时区跳变 | 以毫秒时间戳存储；`dayKey` 用本地时区计算，跨时区旅行会偏移，接受 |
| 空状态 | 每个列表都有空状态文案 + 一个明确动作按钮 |

---

## 12. 测试策略

**单元（Vitest，优先覆盖纯函数）**

- `scheduler`：给定评分序列断言语义（间隔单调、lapses、Easy > Good > Hard > Again、保留率参数生效）。
- `queue`：逾期排序、新题上限、归档排除、04:00 学习日边界、科目轮转。
- `filter`：多条件组合、关键词匹配、标签交集/并集。
- `ink`：归一化往返无误差、缩放后几何一致、抽稀保留端点、橡皮命中判定。
- `backup`：fake-indexeddb 下导出 → 清库 → 导入 → 深比较一致；缺 asset 的容错。

**组件（Testing Library）**

- 录入表单校验与「继续录下一题」保留字段。
- 复习页：看答案前不渲染答案图、评分后进入下一题。
- 列表筛选联动。

**端到端（Playwright，M4 起可选）**

- 录一题 → 首页出现 1 题 → 复习评分 → 核对详情页到期时间。

**手动验证清单（每个里程碑）**

- iPad Safari + Android Chrome 各跑一遍：拍照、笔迹、缩放、安装到桌面、断网打开。

---

## 13. 里程碑与验收

### M1 能录能复习

交付：脚手架、PWA 外壳与图标、Dexie schema、4 科模板、拍照/相册录入 + 框选 + 基本信息、错题本列表与详情（只读图）、FSRS 复习闭环、备份导出/导入。

验收：
- 连续录 3 题，刷新后仍在，首页显示「待复习 3」。
- 复习 3 题，各自评分不同，详情页显示的到期时间符合 FSRS 预期（「忘记」< 1 天，「熟练」> 3 天）。
- 导出 zip，清空浏览器数据，重新导入，题目与图片、复习记录完全恢复。
- 手机与平板浏览器都能完成上述流程。

### M2 能手写

交付：InkCanvas、题目批注、复习书写层、草稿板、笔迹导出 PNG、笔迹开关。

验收：
- 平板上用笔在题图上写字，刷新后笔迹位置不变；横竖屏切换后不变形。
- 手掌压到屏幕不产生乱笔；双指缩放时笔迹跟随图片缩放。
- 复习页默认看不到旧批注，点「显示我的旧批注」后出现。
- 撤销 10 步再重做 10 步，结果与撤销前一致。

### M3 能导卷子

交付：PDF 导入与多题框选、Word 导入、图片增强（亮度/对比度/灰度/二值化）。

验收：
- 从 `839自动控制原理及过程控制.pdf` 任一页框出 2 道题，图片清晰可读（能看清下标）。
- 20 页 PDF 翻页不卡顿、内存不持续增长。
- 增强后的二值化图片文字边缘干净。

### M4 有反馈

交付：统计页（热力图、科目/章节分布、掌握度、14 天到期预测）、搜索、列表筛选、安装引导、备份提醒、空状态打磨、深色模式。

验收：
- 统计数字与数据库计数一致（与详情页核对）。
- 关键词能搜到错误原因与来源。
- 14 天到期预测柱状图与逐题 due 一致。

---

## 14. 风险与限制

1. **iOS 存储回收**：长期不打开的 PWA 可能被系统清理站点数据。缓解：`persist()`、首页备份提醒、导出包建议放网盘。
2. **容量上限**：图片是主要占用，1000 题约 300–500 MB；iOS Safari 单站点上限约 1 GB。缓解：长边 2400 + JPEG、缩略图、孤立资源清理、设置页占用可视化。
3. **无 OCR**：搜索只覆盖文字字段，题干文字不可搜。
4. **换域即换库**：数据绑定在域名 + 浏览器上，迁移只靠备份包；文档中明确写出。
5. **压感差异**：部分 Android 浏览器不提供真实压感，退化为速度调制；视觉上仍平滑。
6. **iOS 通知不可靠**：不做系统推送，只用首页角标与可选站内提醒。
7. **Word 渲染保真度**：复杂公式/表格可能偏差，UI 明示优先 PDF。

---

## 15. 名词表

| 词 | 含义 |
|---|---|
| 错题 / Problem | 一道被收录的题目及其全部信息 |
| 卡 / Card | 绑定在一道错题上的 FSRS 调度状态 |
| 学习日 | 本地时间 04:00 至次日 04:00 |
| 到期 | `card.due` 落在当前学习日之前或之内 |
| 批注层 | 用户对题目原图的永久手写层（`ownerType: 'problem-stem'`） |
| 作答层 | 某一次复习中书写的手写层（`ownerType: 'attempt'`） |
| 归档 | 标记为「已掌握」，移出必复习队列，但保留可查 |
| 保留率 | FSRS 目标记忆保持率，默认 0.90 |
