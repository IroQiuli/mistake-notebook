# 多智能体协作变更日志 (Agent Changelog)

> 本文档用于记录对「考研错题簿 (cuotiben)」项目的架构调整与功能优化，供所有参与维护与协作的 AI 智能体及开发者查阅。

---

## 初始状态基准
- **时间**：2026-10-23
- **Git 备份分支**：`backup-before-review-ux-opt`（基于 `main` 分支最新 commit）
- **核心诉求**：
  1. 修复每日错题作答后未从“待写”移出的问题，实现待写计数精确递减。
  2. 支持在做错题时自己添加、编辑、删除错题备注（心得）。
  3. 支持对已添加的答案图片进行单张删除管理。
  4. 体验全方位升级：首页待写清单弹窗、复习页答题计时器、剪贴板一键粘贴 (`Ctrl+V`)、2027 考研倒计时看板。

---

## 变更历史记录

### Step 1: 建立备份与协作文档
- 创建 Git 备份分支 `backup-before-review-ux-opt`，保证随时可还原至原始状态。
- 创建跟踪日志文档 `docs/AGENT_CHANGELOG.md`。

---

### Step 2: 改造算法核心 `src/domain/queue.ts`
- **目的**：彻底杜绝“做完题目未移出待写”与“配额回补将刚做完的题目再次拉入待写”的问题。
- **改动详情**：
  - `QueueOptions` 增加 `reviewedTodayIds?: Set<string>` 与 `reviewedCounts?: Record<string, number>`。
  - 在遍历全部题目加入队列候选时，若在 `reviewedTodayIds` 中则直接跳过，彻底切断当日已做题目重新进入 `due`、`fresh` 或 `later`。
  - 在 `applyQuotas` 中，按 `remainingQuota = Math.max(0, quota - done)` 抵扣今日已写数量。如果科目今日已写满，则不再拉取任何待写题。
  - 在 `limit` 裁剪时，扣减今天已写数量：`remainingLimit = Math.max(0, limit - todayDone)`。
  - 新增并导出辅助函数：
    - `getTodayReviewedIds(logs: ReviewLog[], now: number): Set<string>`
    - `getTodayReviewedBySubject(logs: ReviewLog[], problemMap: Map<string, Problem>, now: number): Record<string, number>`
- **单测覆盖**：在 `src/domain/queue.quota.test.ts` 新增 3 项单测，验证今日做完题移出待写、配额抵扣不反弹拉题。

---

### Step 3: 改造首页交互 `src/features/today/TodayPage.tsx`
- **目的**：使首页大卡片真实反映“剩余待写题数”，并支持查阅待写清单与考研倒计时。
- **改动详情**：
  - 调用 `getTodayReviewedIds` 与 `getTodayReviewedBySubject`，将已做题集与各科已做数传入 `buildQueue`，使得 `queue.length` 成为精准的**剩余待写数量**。
  - 当今日待写归零且今日有完成记录时（`queue.length === 0 && todayReviewed > 0`），展示醒目的祝贺卡片：`🎉 今日错题已全部清空！保持稳健节奏，稳步上岸！`。
  - 使“今天要写的 X 道”大卡片支持交互点击，唤起 **今日待写清单弹窗**（`showPendingDialog`），直观浏览今日待写题目、科目颜色标、章节、错因预览，点击任一题可定向打开。
  - 顶部增加 **2027 考研初试倒计时看板**，自动计算距离当年考研初试剩余天数，给予考生明确目标感。

---

### Step 4: 改造复习会话与交互 `src/features/review/useSession.ts` & `ReviewPage.tsx`
- **目的**：复习会话与首页待写计划保持一致，支持实时计时、做题即时备注增删改、答案图片删除。
- **改动详情**：
  - **`useSession.ts`**：
    - 加载复习队列时同步读取 `subjectGoals` 与 `dailyGoal`，并传入 `reviewedTodayIds` 和 `reviewedCounts`，保证进入复习页面时与首页待写清单完全一致。
    - 导出 `updateCurrentNote(wrongNote)`：支持即时更新当前题目的错因备注。
    - 导出 `deleteCurrentAnswerAsset(assetId)`：支持即时从当前题目中剔除某张答案图。
    - 导出 `updateCurrentMastery(mastery)`：支持即时调整掌握度。
  - **`ReviewPage.tsx`**：
    - 顶部状态栏优化为：`第 X 题 (剩余 Y 题)`，做完一题进度清晰。
    - 顶部右侧新增 **考研答题计时器（秒表）**：切题自动归零，支持点击暂停/继续，助力把控大题作答时间。
    - 对答案区域增强：
      - 答案图片每张右上角提供红色垃圾桶按钮，点击弹出确认弹窗后可安全删除该张答案图。
      - 增加“添加答案图”按钮，支持在复习中直接抓取并补充新答案图。
      - 错因与心得备注区域提供“修改备注/添加备注”按钮，点击弹出文本编辑弹窗，可即时修改、保存，或点击“清空删除”一键抹除。

---

### Step 5: 改造详情页操作 `src/features/problem/ProblemPage.tsx`
- **目的**：在题目详情页同样支持单张答案图片删除与快捷备注编辑。
- **改动详情**：
  - 为答案图片列表中的每张缩略图增加删除按钮与二次确认 Dialog，点击后从 `answerAssetIds` 中安全移除。
  - “当时为什么错 · 错因备注”区域无论是否有历史备注均优雅呈现，提供“编辑备注”按钮与弹窗，支持即时保存或一键清空删除。

---

### Step 6: 录入提效 `src/features/capture/CapturePage.tsx`
- **目的**：支持平板与电脑端截图直接剪贴板粘贴，免去文件保存再选择的繁琐。
- **改动详情**：
  - 页面添加全局 `paste` 事件监听（支持 `Ctrl+V`），检测到图片自动载入进入裁剪。
  - 选图页面新增“从剪贴板粘贴”高亮按钮（带快捷键标识），点击自动调用 `navigator.clipboard.read()` 读取图像。

---

## 验证结论（批次一）
- **单测套件**：执行 `npm test`，全部 21 个测试文件、124 个单元测试 100% 通过（零回归）。
- **静态类型与构建**：执行 `npx tsc --noEmit` 零报错；`npx vite build` 成功打包生成 PWA 产物。
- **功能点覆盖**：已满足并超额交付用户所有诉求。

---

## 变更批次二：错题排期Bug根除、Cropper八点拉伸与极速草稿箱录题优化
- **时间**：2026-10-23
- **Git 备份分支**：`backup-before-crop-queue-opt`
- **核心诉求**：
  1. 修复新上传题目无视权重进入“今日清单”的严重 Bug，使对应权重的题目出现在对应的复习日期，绝不在当天录题时进入今日复习队列。
  2. 增强裁剪框交互：录入裁剪框支持拖动四个角和上下/左右边缘自由调节长宽。
  3. 极大提升批量录题效率，同时兼顾每道题精准打标签（经用户交互确认：采用“极速连拍草稿箱 + 原图连续截题 + 试卷属性智能继承 + 题号自增”方案）。

### 改动详细记录

#### 1. 排期算法修复与权重阶梯绑定 (`src/domain/weight.ts` & `src/storage/problems.ts` & `src/domain/queue.ts`)
- **根因分析**：
  - `src/storage/problems.ts` 在 `createProblem` 时只依据 `mastery` 相对时间偏移计算 `due`，忽略了显式传入的 `weight`；
  - `src/domain/queue.ts` 的科目配额回补逻辑（`applyQuotas`）在今日到期题不足时，会从未到期题库 `later` 中抓取最早到期的题目作为 `auto` 填充，导致刚录入的未到期新题被立即拉进今日清单。
- **改动详情**：
  - 在 `src/domain/weight.ts` 中确立权威的权重到首重复习天数的阶梯映射 `WEIGHT_INITIAL_DAYS`：
    - 0~2 (重点): 1 天后（明天）
    - 3~4 (偏弱): 2~3 天后
    - 5~6 (一般): 5~7 天后
    - 7~8 (较熟): 10~14 天后
    - 9~10 (很熟): 21~30 天后
  - 新增 `calcInitialDue(weight, now)`，首重时刻严格对齐到目标学习日的上午（09:00），确保题目整齐出现在目标日列表中；
  - 改造 `src/storage/problems.ts` 中的 `createProblem` 与 `setWeight`，未复习新题修改权重时联动更新卡片到期日；
  - 改造 `src/domain/queue.ts` 的 `applyQuotas`，设立铁律：**严禁将尚未经过初次复习的新题（`card.state === 0`）作为 filler 补齐拉入今日清单**。
  - 改造 `src/features/capture/MetadataFields.tsx`：在分类表单中增加权重（0~10）微调控件，实时预览 `下次复习：X 天后 (M月D日)`。

#### 2. Cropper 8 点手柄自由拉伸 (`src/features/capture/Cropper.tsx`)
- **改动详情**：
  - 增加 4 个角落手柄（NW, NE, SW, SE）与 4 条边中点手柄（N, S, W, E）；
  - 配置移动端友好触控区（Hitbox $\ge 36\text{px}$）与越界翻转自适应保护；
  - 增加三等分参考网格线，辅助对准数学公式、大题图表与题干边缘；
  - 完美兼容已有单指平移、双指缩放平移与重画功能。

#### 3. 极速连拍草稿箱与连续录题流 (`src/storage/db.ts`, `src/storage/drafts.ts`, `src/features/capture/`)
- **改动详情**：
  - Dexie 数据库升级至版本 2，新增 `drafts` 表暂存连拍与多选卷子图片；
  - 选图页面新增“极速连拍”入口与相册“支持多选入箱”（`multiple`），拍完自动存入草稿箱；
  - 页面顶部提供 `DraftInbox` 草稿箱面板，展示待处理草稿缩略图瀑布流与角标，支持一键开录或单张剔除；
  - 录完一道题后，自动从草稿箱中销毁已完成原图，并在完成页提供“处理草稿箱下一张”与“在当前原图继续截下一题”双重极速通道；
  - 在 `src/features/capture/defaultMeta.ts` 实现会话级试卷属性继承（科目、年份、卷名、章节）与题号智能自增（`incrementNo`），每道题仅需关注自身知识点与错因，录题效率提升数倍。

### 验证结论（批次二）
- **单测套件**：执行 `npm test`，全部 22 个测试文件、129 个单元测试全部 100% 通过（新增 5 项单测覆盖排期阶梯、草稿存储与题号自增）。
- **静态类型检查**：执行 `npx tsc --noEmit` 零报错、类型完全安全。
- **PWA 构建**：执行 `npx vite build` 打包成功，产物正常生成。

---

## 变更批次三：逾期排期顺延靠前、录题同步添加答案、年份快捷选择与知识点标签编辑
- **时间**：2026-10-24
- **Git 备份分支**：`backup-before-overdue-and-capture-answer-opt`
- **核心诉求**：
  1. **逾期错题顺延与排期靠前**：昨天或以往没做完的逾期题目自动顺延到今天，且在今天复习清单中排在最前；同时在各科目轮转交替时，优先轮转所有逾期题，再轮转今天到期题目。
  2. **录题流程支持同步添加答案**：录入错题时即可直接添加答案与解析图片（支持拍照、相册多选、剪贴板粘贴），保存时一并入库。
  3. **年份快捷选择**：录题时年份无需调起软键盘手输，提供 2020~2026 常用年份快捷 Chips 与 2000~2027 下拉选择器。
  4. **知识点标签管理与修改**：支持对已有知识点标签进行重命名和删除（删除时自动级联清理题目关联）。

### 改动详细记录

#### 1. 逾期排期顺延与优先级置顶 (`src/domain/queue.ts` & `src/features/today/` & `src/features/review/`)
- **排期算法核心**：
  - 在 `src/domain/queue.ts` 中使用 `dayDiff(c.due, now)` 计算 `overdueDays = diff < 0 ? -diff : 0`，准确消除因零点/学习日 4:00 边界引起的非预期误差。
  - 所有到期日早于今天的逾期题目（`overdueDays > 0`，无论处于 `state: 0` 还是 `state: 2`）统一标记并在优先级评分中大幅加分（基础分 1000 + 每天额外 100 分），确保稳居顶层。
  - 改造跨科目轮转调度算法 `interleaveBySubject` 为两段式轮转机制：
    1. 第一阶段：对所有包含逾期题目的科目进行 round-robin 轮转，优先把昨天未做完的题目交替排在最前列；
    2. 第二阶段：对正常今日到期的题目进行 round-robin 轮转紧随其后。
  - 在 `src/domain/queue.test.ts` 新增单测，严格验证“昨天未做完的逾期题目顺延到今日且排在最前”。
- **UI 视觉反馈**：
  - `src/features/today/TodayPage.tsx`：待写清单弹窗中的逾期题目增加鲜艳的小徽章（`昨日顺延` 或 `逾期N天`），用户一目了然。
  - `src/features/review/ReviewPage.tsx`：复习界面顶部栏当做逾期题时展示 `昨日顺延 / 逾期N天` 醒目徽章。

#### 2. 录题阶段直接添加答案图 (`src/features/capture/` & `src/storage/problems.ts` & `src/features/problem/`)
- **表单支持**：
  - `src/features/capture/ProblemForm.tsx` 增加“答案与解析图片（选填）”折叠卡片，支持拍照、相册多选、以及剪贴板一键粘贴，支持缩略图横向轮播与单张删除。
  - `onSubmit` 扩展为 `(meta: MetaValue, answerBlobs?: Blob[]) => Promise<void>`。
- **持久化闭环**：
  - `src/features/capture/CapturePage.tsx` 中的 `save` 函数接收 `answerBlobs`，通过 `prepareImage(b, 2400)` 压缩并写入 Dexie `assets` 表（类型 `answer`），将生成的 `answerAssetIds` 一并传入 `createProblem`，录题流程一步到位。
  - `src/features/problem/ProblemPage.tsx` 中的编辑表单弹窗同步适配 `answerBlobs`，编辑时新添的答案图同样自动压缩保存。

#### 3. 年份快捷选择器 (`src/features/capture/MetadataFields.tsx`)
- 移除了传统的纯数字输入框，改为：
  - `2020~2026` 常用年份快捷 Chips（一键高亮选中并支持二次点击反选取消）；
  - 搭配 2000~2027 下拉选择框（`<select>`），彻底告别移动端弹出数字软键盘手输的低效体验。

#### 4. 知识点标签可修改与管理 (`src/storage/problems.ts` & `src/features/capture/MetadataFields.tsx`)
- **存储层接口**：
  - 在 `src/storage/problems.ts` 导出 `updateTopic(id, name)`（重命名标签）与 `deleteTopic(id)`（事务内同时清理所有关联题目中的 `topicIds` 引用）。
- **交互层设计**：
  - 在分类表单的知识点区域提供“管理标签”切换开关，开启后每个标签展示编辑笔与删除垃圾桶图标；
  - 点击编辑笔弹出快速重命名弹窗，即时保存生效；
  - 点击垃圾桶即刻安全删除并清理题目引用；
  - 在 `src/storage/problems.test.ts` 新增对 `updateTopic` 和 `deleteTopic` 的完整单测验证。

### 验证结论（批次三）
- **单测套件**：执行 `npm test`，全部 22 个测试文件、132 个单元测试全部 100% 通过（新增 3 项针对逾期顺延置顶、答案图携带与标签修改级联删除的单测）。
- **静态类型检查**：执行 `npx tsc --noEmit` 零报错，全工程类型安全无隐患。
- **PWA 构建**：执行 `npx vite build` 成功打包生成生产环境产物（dist 校验通过）。
