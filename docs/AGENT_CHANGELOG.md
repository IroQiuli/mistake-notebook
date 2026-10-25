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

---

## 变更批次四：初音未来 (01 MIKU) 专属主题错题本 Demo（本地隔离免推送）
- **时间**：2026-10-24
- **Git 独立测试分支**：`demo-hatsune-miku-theme`（本地专用，严格不推送到 GitHub 远程仓库）
- **核心诉求**：
  1. 为考研错题本打造「初音未来 (01 MIKU)」专属主题 Demo；
  2. 融入网络精选 4K 超高清壁纸与毛玻璃亚克力质感，在保证数学公式与字迹 100% 清晰度的前提下打造二次元学习桌面；
  3. 保留「经典考研橙」与「初音未来」一键平滑切换对比，并提供 4K 壁纸画廊、自定义在线 4K URL 与模糊度/遮罩微调；
  4. 遵照用户要求，所有代码改动与资源仅在本地运行与预览，绝对不执行 `git push`。

### 改动详细记录

#### 1. 初音主题色彩引擎与 CSS 变量重映射 (`src/index.css`)
- 在 Tailwind CSS v4 框架下定义 `[data-theme="miku"]`：
  - 将 `--color-brand` 设置为官方经典初音蓝绿 `#39C5BB`（39=Miku），辅色配置发带粉 `#FF5E97`；
  - 精准将 Tailwind `--color-orange-50` 到 `--color-orange-950` 全阶梯映射为初音蓝绿色阶（500 对应 `#39c5bb`，600 对应 `#29a89f`）；
  - 全局所有既有按钮、进度条、徽章、Tab 高亮无需改动既有代码即刻无缝换装；
  - 针对带有 4K 壁纸的沉浸模式，引入 `.has-wallpaper` 适中磨砂毛玻璃规则（`rgba(255,255,255,0.82) backdrop-blur-md`），兼顾观赏性与护眼高对比度。

#### 2. App 外壳全屏 4K 背景与 Miku 细节定制 (`src/App.tsx`)
- 动态监听主题与壁纸设置，自动设置 `data-theme="miku"` 和 `has-wallpaper` 类名；
- 改造 `Shell` 布局容器：
  - 采用独立全屏固定背景层渲染 4K 壁纸，支持动态微调模糊度（`filter: blur`）与暗色遮罩（消除移动端滚动卡顿白边）；
  - PC 端侧边栏与移动端底部栏升级为磨砂亚克力玻璃材质；
  - 侧边栏微标定制：Miku 主题下展示带有呼吸光感的「`01`」霓虹徽章，带有 `#ff5e97` 粉色 39 标识与「初音未来 · 错题簿」字样。

#### 3. 外观设置面板升级与 4K 壁纸画廊 (`src/features/settings/SettingsPage.tsx`)
- 在「外观与主题」面板增加：
  - **主题风格选择卡片**：在「初音未来 01 MIKU」与「经典考研橙」之间随时一键切换对比；
  - **精选 4K 初音壁纸库**：内置并离线缓存 3 款高分辨率壁纸（星空浅葱 4K、宇宙银河 4K、经典立绘 4K），一键即刻切换生效；
  - **自定义在线 4K 壁纸直链**：支持输入任意网络 4K 图片 URL 一键应用；
  - **壁纸视觉精细调节**：实时调节背景模糊度（0px 原画极清 ~ 10px 柔和虚化）与暗色遮罩透明度（0% ~ 35%）；
  - **本地 4K 壁纸上传**：放宽最大边限制至 3840 像素，避免 4K 壁纸被过度压缩失真。

#### 4. 首页氛围与伴学寄语 (`src/features/today/TodayPage.tsx`)
- 考研倒计时看板换装初音专属蓝绿/粉色渐变，增加「01 伴学中」小微标与脉冲光点；
- 待写清单与全部清空完成提示加入 Miku 伴学鼓励文案（“39！今日错题已全部清空，保持稳健节奏，Miku 陪你稳步上岸！”）。

### 验证结论（批次四）
- **单测套件**：执行 `npm test`，全部 22 个测试文件、132 个单元测试保持 100% 通过（零回归）。
- **静态类型检查**：执行 `npx tsc --noEmit` 零报错，严格类型安全。
- **PWA 构建**：执行 `npx vite build` 打包成功，产物正常生成。
- **Git 状态**：改动已保存在独立本地分支 `demo-hatsune-miku-theme`。

---

## 变更批次五：做题评分算法修复（杜绝前三按钮为今天）、初音未来全套小组件Icon与专属启动画面、同步至 GitHub
- **时间**：2026-10-24
- **Git 分支**：`demo-hatsune-miku-theme` 合并入 `main` 并推送到 GitHub 远程仓库
- **核心诉求**：
  1. **做题评分选项为「今天」的算法 Bug 彻底根治**：
     - 用户反馈：“为什么我的今日清单下方前三个按钮点击后都是‘今天’”。
     - 查明原因：`ts-fsrs` 默认配置中开启了生词卡单日短步长（`enable_short_term: true`，学习步长 `1m, 10m`），导致新题和重学题的前三个评分（忘记、困难、良好）仅被安排在 1分钟、5分钟、10分钟后，被 `dayDiff` 判定为同一个学习日（`diff === 0`），使得页面显示均为“今天”，且做完依然停留在今天。
     - 修复方案：在 `src/domain/scheduler.ts` 中配置 `enable_short_term: false`，明确考研错题复习以天（学习日）为最小周期，评分后最低推进 1 天（明天），严格保持阶梯递增（忘记 $\ge$ 明天、困难 $\ge$ 2天后、良好 $\ge$ 3天后、简单 $\ge$ 8天后）。
  2. **初音未来全套小组件 Icon 定制** (`src/ui/MikuIcons.tsx` & `src/App.tsx`)：
     - 首页 (Home)：初音未来经典象征「大葱 (Negi)」标志图标；
     - 错题本 (Library)：葱绿乐谱 / 活页试卷夹 (Music Binder) 图标；
     - 录题 (Capture)：现场收音舞台麦克风与灵感星芒 (Stage Mic) 图标；
     - 统计 (Stats)：跳动的音律音频波形频谱 (Soundwave Equalizer) 图标；
     - 我的 (Settings)：初音未来标志性头戴式赛博耳机与发带方块 (Miku Headset) 图标；
     - 首页环形进度条 `ProgressRing` 自动响应初音 `#39c5bb` 专属葱绿。
  3. **软件专属 Icon 与 PWA 启动画面 (Splash Screen)** (`index.html` & `public/themes/miku/` & `src/main.tsx`)：
     - 设计并生成 `public/themes/miku/miku-icon.svg` 高清矢量图标（包含 01 霓虹铭牌、初音蓝绿底色、粉色发圈与 39 标识）；
     - 在 `index.html` 中注入 Miku 专属冷启动 Splash 画面：带有 01 霓虹呼吸徽标、5 段音乐跳动音频条动效与“初音ミク · 考研伴学错题簿”伴学标语，React 挂载后通过 `src/main.tsx` 平滑淡出；
     - 动态切换主题 Favicon 与网页标题（“初音未来 · 考研伴学错题簿”）。
  4. **全量合并与 GitHub 同步**：
     - 将上述所有初音主题实现、4K 壁纸、图标体系以及做题排期 Bug 修复，全量合并至 `main` 分支并执行 `git push origin main`。

### 验证结论（批次五）
- **单测套件**：执行 `npm test`，全部 22 个测试文件、133 个单元测试全部 100% 通过（新增针对四档评分排期天数推进的严格单测）。
- **静态类型检查**：执行 `npx tsc --noEmit` 零报错。
- **PWA 构建**：执行 `npx vite build` 成功打包生成生产环境产物。
- **版本库同步**：已成功推送到 GitHub 远程仓库 `main` 分支。

---

## 变更批次六：平板端壁纸空白问题修复（路径解析与 WebKit 层叠上下文适配）
- **时间**：2026-10-24
- **Git 分支**：`main`（推送到 GitHub 远程仓库）
- **核心诉求**：
  - 用户反馈：“我在电脑端可以显示壁纸，但是在平板上却是空的？怎么回事”。
- **根因分析**：
  1. **GitHub Pages 二级子路径 404 陷阱**：
     - GitHub Pages 部署路径为 `https://iroqiuli.github.io/mistake-notebook/`；
     - 原代码中的预设壁纸路径写成了以斜杠开头的根绝对路径 `/themes/miku/miku-starry-4k.jpg`；
     - 电脑端因本地开发服务器根目录就是 `/`，所以碰巧能显示；而平板端访问 GitHub Pages 时，浏览器向 `iroqiuli.github.io/themes/...` 发起请求，触发 404 资源不存在！
  2. **移动端 WebKit 层叠遮挡问题**：
     - 外层 Shell 容器带有 Tailwind `bg-zinc-50`（不透明浅灰底），在 iPadOS/WebKit 移动端排版合成中直接绘制并遮挡了位于 `z-0` 的固定背景层；
  3. **PWA Workbox 离线缓存缺失**：
     - `vite.config.ts` 中的 `globPatterns` 仅缓存了 `js,css,html,png,svg,woff2`，漏掉了 `jpg` 格式，导致平板端 PWA 无法离线命中 4K 壁纸。
- **修复方案**：
  1. **动态多端路径解析 (`src/lib/themeUrl.ts`)**：
     - 封装 `resolveThemeUrl`，自动读取 `import.meta.env.BASE_URL` 动态补齐子路径前缀，确保在本地开发（`/`）和 GitHub Pages（`/mistake-notebook/`）下 100% 准确命中资源；
  2. **容器与全局背景穿透 (`src/App.tsx` & `src/index.css`)**：
     - 当开启壁纸时，外层容器自动切换为 `bg-transparent`，并在 `src/index.css` 中声明 `html.has-wallpaper body, #root { background-color: transparent !important; }`，杜绝任何不透明底色遮挡；
     - 背景层添加硬件加速属性 `translateZ(0)`，防止 Safari/WebKit 在高分屏下的渲染丢帧；
  3. **PWA 预缓存扩容 (`vite.config.ts`)**：
     - 将 `jpg,jpeg,webp` 纳入 Workbox 预缓存列表并扩容至 8MB，让平板端 4K 壁纸秒开且完全支持离线显示。

### 验证结论（批次六）
- **单测套件**：执行 `npm test`，全部 133 项单元测试 100% 通过。
- **静态类型检查**：执行 `npx tsc --noEmit` 零报错。
- **PWA 构建**：打包产物生成 16 个 precache 条目（包含 4K 壁纸全部打入），验证通过。
- **GitHub 同步**：提交并推送到 GitHub `main` 分支。

---

## 变更批次七：4K 壁纸库扩充、初音封面图标更换与全软件 Q 版元素深度集成
- **时间**：2026-10-24
- **Git 分支**：`main`（推送到 GitHub 远程仓库）
- **核心诉求**：
  1. 扩充 4K 初音壁纸库，提供涵盖樱花、窗前、落日、星河、赛博、和服等多元风格的超清壁纸，在设置页提供画廊供自由选择。
  2. 软件封面与桌面 App 图标全面换成初音未来专属图标（包括 PWA 192、512、Apple Touch Icon、Favicon、Web Manifest）。
  3. 软件内部多处加入初音未来 Q 版形象元素，替换掉原先冷冰冰的功能图标（做题四档评分、通关庆祝、连续打卡天数、待写清单、考研倒计时等）。
- **具体实现**：
  1. **4K 壁纸库扩充至 9 款精品预设 (`public/themes/miku/` & `SettingsPage.tsx`)**：
     - 下载并高质量优化 6 款超高清原图（樱花和风 5K、窗前静谧 4K、落日余晖 8K、璀璨星河 5K、赛博都市 8K、白无垢和服 4K）；
     - 将超大无损 PNG 采用 92% 高质量压制为轻量级 JPEG（体积自 15MB 缩至 2MB，维持 4K 画质细节同时符合 Workbox 8MB 缓存限制）；
     - 在 `SettingsPage.tsx` 中升级画廊网格为 3×3 九宫格，支持缩略图预览与一键切换。
  2. **软件封面与 PWA 图标全面更换 (`public/` & `vite.config.ts`)**：
     - 升级 `miku-icon.svg` 为双马尾流线轮廓、头戴耳机发箍、粉黑发饰方块、霓虹 01 经典图腾与音乐均衡器的初音专属徽章；
     - 通过无头浏览器脚本将矢量 SVG 渲染为高清无损 PNG，彻底替换原先的橙色“错”字图标：
       - `public/icon-512.png` (512×512)
       - `public/icon-192.png` (192×192)
       - `public/apple-touch-icon.png` (180×180)
       - `public/favicon.svg`
     - 更新 `vite.config.ts` 中的 PWA Web Manifest 配置，应用名设为「初音未来 · 考研错题簿」，主题色与背景色对应初音专属 `#39c5bb` 和 `#091a18`。
  3. **初音未来 Q 版形象体系构建 (`src/ui/MikuChibi.tsx`)**：
     - 构建纯矢量无损、轻量级、带腮红与葱绿发丝的初音未来 Q 版表情组件族：
       - `MikuChibiDizzy`：1:忘记 评分按钮（蚊香眼/冒冷汗/波浪嘴困惑初音）；
       - `MikuChibiThinking`：2:困难 评分按钮（小手挠头思考/点唇困惑小问号初音）；
       - `MikuChibiThumbsUp`：3:良好 评分按钮（笑眯眯眼/竖起大拇指点赞初音）；
       - `MikuChibiSparkle`：4:简单 评分按钮（Wink眨眼/比耶剪刀手/星芒元气初音）；
       - `MikuChibiCelebrate`：做题通关与清空错题（双马尾挥动、手举大葱撒花纸屑、39 标志大图）；
       - `MikuChibiSprint`：考研倒计时看板（系红底必胜头巾、带奔跑风线的冲刺初音）；
       - `MikuChibiCheer`：连续打卡看板（跃动音符元气初音）；
       - `MikuChibiLeek`：待写清单标签（怀抱新鲜翠绿大葱初音）。
  4. **全链路交互集成 (`ReviewPage.tsx` & `TodayPage.tsx`)**：
     - 在复习做题底部的四档评分按钮上，根据当前主题动态展示对应的 Chibi 初音微表情，让做题评分兼具解压趣味与即时情绪价值；
     - 复习完成页与今日错题全部清空卡片，呈现欢腾的 `MikuChibiCelebrate` 撒花微动效并配有“39！初音未来为你点赞”励志标语；
     - 首页打卡天数、考研冲刺倒计时、待写清单胶囊全面装配 Q 版初音元素。

### 验证结论（批次七）
- **单测套件**：执行 `npm test`，全部 22 个测试套件、133 项单元测试 100% 保持全绿。
- **静态类型检查**：执行 `npx tsc --noEmit` 零类型警告与错误。
- **生产打包**：`vite build` 成功完成打包，生成 23 项 precache 离线资源。
- **本地服务**：Vite 开发服务器运行正常。

---

## 变更批次八：顺延逻辑精准界定（已写题目杜绝顺延）、数据自愈与 PWA 强制刷新升级
- **时间**：2026-10-25
- **Git 分支**：`main`（推送到 GitHub 远程仓库）
- **核心诉求**：
  1. 用户反馈：“为什么我在平板上刷新后还是没有最新版的改动” —— 移动端/iPadOS PWA Service Worker 强缓存导致即便刷新仍加载旧版本代码。
  2. 用户反馈：“我要昨日顺延的是没写的题，写完的题你顺延干嘛？” —— 彻底界定顺延范围，只有真正未做完的题目才顺延，已做完的题目绝不能标记为“昨日顺延”，同时自愈修复历史数据。
- **具体实现**：
  1. **顺延边界严格界定 (`src/domain/queue.ts` & `src/domain/queue.test.ts`)**：
     - 新增并导出 `isOverdueUnfinished(c: Card, now: number): boolean` 判定函数；
     - 只有当 `c.due` 早于今天，**并且**在到期日当天及之后从未复习过（`!c.lastReview || c.lastReview < learningDayStart(c.due)`）时，才作为真正的“昨日/以往未做完顺延”；
     - 凡是在到期日当天或之后已经作答完毕的题目（`c.lastReview >= learningDayStart(c.due)`），`overdueDays` 强制归零，绝不标记为“昨日顺延”，不强行置顶；
     - 补充单测 `昨日已经做完复习的题目绝不顺延且不标记为逾期`，验证通过。
  2. **历史停滞数据自动治愈 (`src/domain/heal.ts`)**：
     - 编写自愈修复模块 `healCards()`，在应用启动及手动刷新时自动静默执行；
     - 扫描卡片表中因早期短步长 bug 导致 `due <= lastReview` 停滞在过去的卡片，根据其最后一次 reviewLog 的评分（1/2/3/4）重新推进到对应的未来学习日早晨（09:00），消除平板历史脏数据。
  3. **PWA 极速激活与自动更新 (`vite.config.ts` & `src/main.tsx` & `tsconfig.json`)**：
     - 在 `vite.config.ts` 中配置 Workbox：
       - `skipWaiting: true`：新 Service Worker 安装后立即跳过等待接管控制权；
       - `clientsClaim: true`：立即控制所有打开的页面；
       - `cleanupOutdatedCaches: true`：自动清除旧版本缓存文件；
     - 在 `src/main.tsx` 中集成 `registerSW({ immediate: true, onNeedRefresh })`，当检测到 GitHub Pages 发布新版本时自动触发热更新。
  4. **设置页提供一键强制脱壳刷新 (`src/lib/version.ts` & `src/features/settings/SettingsPage.tsx`)**：
     - 新增 [src/lib/version.ts](file:///d:/浏览器下载用/学习/cuotiben/src/lib/version.ts)，提供 `forceReloadAndClearCache()` 函数；
     - 在设置页新增「版本与系统更新」专区，展示当前版本 `v0.8.2 · 初音未来版`，并提供「强制刷新升级」按钮；
     - 点击后一键注销当前全部 Service Worker、清除 CacheStorage 离线包、执行卡片排期自愈并附加随机时间戳强制重新拉取最新版本。

### 验证结论（批次八）
- **单测套件**：执行 `npm test`，全部 22 个测试套件、134 项单元测试 100% 绿色通过。
- **静态类型检查**：执行 `npx tsc --noEmit` 0 警告、0 错误。
- **生产打包**：`vite build` 成功完成打包，包含 workbox-window 与最新版本资源。

---

## 变更批次九：沉浸式真·全屏图片放大与多维视图优化（突破弹窗限制）
- **时间**：2026-10-25
- **Git 分支**：`main`（推送到 GitHub 远程仓库）
- **核心诉求**：
  - 用户反馈：“点击图片放大可以提供一个全屏放大的选项，现在的图片看着还是有点小”。
  - 分析根因：原先在 `ReviewPage`、`ProblemPage` 中查看大图时，均嵌套在 `Dialog` 中（受限于 `max-w-2xl` 即 672px 宽度与 70vh 高度限制）。在平板电脑（如 iPad 10~13 英寸高分屏）或电脑端，错题密集的推导步骤、复杂公式与手写字迹在 672px 宽度下显得局促狭小，留有大量空白边缘。
- **具体实现**：
  1. **全屏沉浸式图片组件 (`src/ui/ZoomableImage.tsx`)**：
     - **React Portal 突破容器限制**：引入 `isFullscreen` 状态，当开启全屏时使用 `createPortal` 挂载至 `document.body`，以 `fixed inset-0 z-[99999] w-screen h-screen bg-black/95` 占满 100% 视口无黑边无拘束，图片以原生最大比例呈现；
     - **多维手势与缩放交互**：
       - 双指捏合缩放（移动端/平板触控）；
       - 单指/鼠标平移拖拽（放大后随意移动视口）；
       - 鼠标滚轮平滑缩放（`onWheel` 精准缩放至 1x~8x，适配桌面端与外接鼠标平板）；
       - 双击/双触快速 2.5x 放大 / 1:1 复位；
     - **全屏顶部半透明毛玻璃工具栏**：
       - 展示题目/答案标题与实时缩放百分比徽章（如 `100%`、`180%`、`320%`）；
       - 快捷缩小 `(-)`、放大 `(+)` 与 `1:1` 一键复位按钮；
       - 原生浏览器全屏扩展与 `退出全屏` / `关闭 (✕)` 按钮；
       - 支持键盘快捷键：`Esc` 退出全屏、`+`/`-` 缩放、`0` 复位；
     - **内嵌模式与弹窗模式入口**：
       - 在非全屏容器右上角渲染高质感悬浮胶囊按钮 `[ ⛶ 全屏放大 ]`，左下角/右下角提供快捷缩放与比例复位；
  2. **弹窗尺寸扩展 (`src/ui/Dialog.tsx`)**：
     - 在 `Dialog` 尺寸中增加 `size="xl"` (`max-w-5xl`，宽度达 1024px) 与 `size="full"`，将普通预览弹窗在平板与大屏上的可视面积大幅扩容 52%；
  3. **复习做题页集成 (`src/features/review/ReviewPage.tsx`)**：
     - 题干大图卡片右上角配备独立高亮 `[ ⛶ 全屏放大 ]` 直达入口，点击无需经过弹窗直接以 100% 视口全屏展开；
     - 参考答案图片缩略图卡片上配备 `[ ⛶ 全屏 ]` 快捷入口；
     - 弹窗大图升级为 `size="xl"`，并在弹窗内随时可点击“全屏放大”展开为真全屏；
  4. **题目详情页与章节页集成 (`src/features/problem/ProblemPage.tsx` & `src/features/library/ChapterPage.tsx`)**：
     - 题目详情页题干与答案图片卡片均配备全屏放大能力；
     - 章节列表大图预览直接启用全屏沉浸模式；
  5. **自动化测试套件 (`src/ui/ZoomableImage.test.tsx`)**：
     - 新增针对 `ZoomableImage` 的 4 项专属单元测试（默认内联渲染、全屏 Portal 切换、`initialFullscreen` 配合 `Escape` 监听、快捷按钮缩放比例更新）。

### 验证结论（批次九）
- **单测套件**：执行 `npm test`，全部 23 个测试套件、138 项单元测试 100% 全部通过。
- **静态类型检查**：执行 `npx tsc --noEmit` 0 警告、0 错误。
- **生产构建**：`vite build` 生产构建成功，生成 23 项 precache 离线包。

---

## 变更批次十：全面废除代码自画SVG、直接嵌入网络官方级 Project Sekai Q版初音高清透明素材
- **时间**：2026-10-25
- **Git 分支**：`main`（推送到 GitHub 远程仓库）
- **核心诉求**：
  - 用户明确指示：“你用的q版miku不要自己用代码搓，直接用网上现有的q版素材嵌入，现在的有点丑”。
  - 彻底摒弃手工编写粗糙 SVG 贝塞尔曲线的方式，直接引入世界公认、画质顶级、表情灵动生动的官方《世界计划 / Project Sekai》初音未来纯透明背景高清素材。
- **具体实现**：
  1. **素材引入与本地离线集成 (`src/assets/miku/` & `public/miku/chibi/`)**：
     - 精准匹配做题与伴学各场景，精选 10 款官方纯透明 Alpha 通道 WebP 高保真素材：
       - `dizzy.webp` (miku_06): 咬手指冷汗困扰初音 —— 对应 **1: 忘记 (Again)**；
       - `thinking.webp` (miku_04): 手抚下颌倒吸凉气“好难”初音 —— 对应 **2: 困难 (Hard)**；
       - `thumbsup.webp` (miku_07): 俏皮眨眼点赞大拇指初音 —— 对应 **3: 良好 (Good)**；
       - `sparkle.webp` (miku_12): 吐小舌比耶剪刀手初音 —— 对应 **4: 简单 (Easy)**；
       - `celebrate.webp` (miku_38): 拉响金色礼花筒彩带漫天飞舞初音 —— 对应 **错题通关/清空全部**；
       - `sprint.webp` (miku_03): 双拳紧握充满斗志 "Fight!" 初音 —— 对应 **考研冲刺倒计时看板**；
       - `cheer.webp` (miku_02): 手指跃动音符环绕元气打歌初音 —— 对应 **连续打卡伴学看板**；
       - `leek.webp` (miku_01): 经典双马尾开怀挥手微笑初音 —— 对应 **待写清单与侧栏伴学**；
       - `glowsticks.webp` (miku_28): 双持荧光大葱狂欢初音；
       - `cards.webp` (miku_35): 手持复习卡片与烟花盛典初音；
  2. **组件重构 (`src/ui/MikuChibi.tsx`)**：
     - 彻底删除原先 600 余行手工拼接的劣质 SVG 路径，代码体积缩减 11KB；
     - 重写为极轻量（每张仅 14~20KB）、加载迅速且原生支持 Retian 高分屏的高清图片组件；
     - 配置 `object-contain`, `select-none`, `drop-shadow-xs`, 鼠标 hover 微缩放反馈；
  3. **界面细节美化 (`ReviewPage.tsx`, `TodayPage.tsx`, `App.tsx`)**：
     - 做题评分底栏 4 档按钮微表情升级为官方灵动表情（28px 高清无白边）；
     - 复习完成与清空卡片展示大号金色礼花彩带初音（110px 灵动微动效）；
     - PC 侧边栏与打卡看板加入初音伴学小贴纸。

### 验证结论（批次十）
- **单测套件**：执行 `npm test`，全部 23 个测试套件、138 项单元测试 100% 保持全绿。
- **静态类型检查**：执行 `npx tsc --noEmit` 0 警告、0 错误。
- **生产构建**：`vite build` 成功完成打包，生成 43 项离线缓存资源（含全部初音素材）。
