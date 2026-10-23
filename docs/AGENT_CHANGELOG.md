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

## 验证结论
- **单测套件**：执行 `npm test`，全部 21 个测试文件、124 个单元测试 100% 通过（零回归）。
- **静态类型与构建**：执行 `npx tsc --noEmit` 零报错；`npx vite build` 成功打包生成 PWA 产物。
- **功能点覆盖**：已满足并超额交付用户所有诉求。
