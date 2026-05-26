# AI Photo Cleaner 相似信号接入 Context 规划 - CORE-DUPLICATE-3-PLANNING

## 一、 当前现状

当前项目中同时存在两套相似照片检测与分组的处理路径：

### 1. 旧路径：`detectDuplicates`
- **流程职责**：直接驱动当前前端整理与 A/B 对局主流程。
- **副作用**：在遍历过程中直接改写照片对象，写入 `status`、`suggestedStatus`、`duplicateGroupId`、`displayLabel` 以及 `reasonLabel` 等状态与中文文案属性。
- **依赖性**：当前 `PhotoWorkspaceContext` 中的 `photos` 状态更新、`similarGroups` 初始化与 `Photo Battle` 状态机依然深度依赖此旧函数的直接改写结果。

### 2. 新路径：`buildDuplicateSignals`
- **流程职责**：纯客观分析层（Analysis Layer）函数，仅计算输出 `DuplicateAnalysisResult`。
- **特点**：只包含客观的分组关系 `groups` 与 `photoToGroup` 映射结构。不写照片任何状态，不改写任何照片对象，且不输出任何中文 UI 文案和保留/淘汰倾向性决定。
- **依赖性**：当前仅作为双路生成并存，结果存于 `duplicateSignalResult` 状态中，并仅在开发环境（development）下触发轻量级比对日志做 QA 回归，不改变用户任何实际工作流。

---

## 二、 目标分层架构

未来稳定版本的相似整理将实现物理分层解耦，其各层职责划分如下：

1. **分析层 (`duplicate.ts`)**：
   - 提取客观相似信号，仅计算并输出客观分组结果 `SimilarityGroupSignal`（包含 `groupId`, `photoIds`, `leaderId`, `distance`, `method`），绝不向照片写入 `status` 或中文文案。
2. **用户决定层 (`PhotoWorkspaceContext`)**：
   - 作为内存数据枢纽，负责管理 `photos` 列表、客观的 `duplicateSignalResult`、对局队列 `similarGroups` 以及用户的显式决断状态 `userDecision`。不包含任何中文 UI 文本翻译。
3. **决策层 (`photoDecision.ts`)**：
   - 整合分析层物理标记与用户手动操作，生成业务倾向性建议：`keep`（保留）、`cullCandidate`（淘汰候选）或 `needsBattle`（需要 PK），不包含中文文案，且用户决定（`userDecision`）处于最高优先级。
4. **UI 派生层 (`photoLabelMapping.ts`)**：
   - 负责将决策层建议及状态标记翻译为“保留”、“淘汰候选”和“需要 PK”等友好中文 Badge 词汇。
5. **UI 展现层与导出 (`results/page.tsx`)**：
   - 读取 UI Mapping 派生的 `getUserVisibleBucket` 和 `getReasonTags` 等转译结果来绘制分区卡片与控制 ZIP 导出，调用 UI 状态驱动 PK 对局。

---

## 三、 规划 `SimilarityGroupSignal` 到 `similarGroups` 的转换

为了使新版相似信号能够接入现有的 Photo Battle 流程，我们需要设计并规划一个无副作用的纯转换工具函数：

### 1. 转换函数设计
- **建议名称**：`buildSimilarGroupsFromSignals`
- **入参设计**：
  - `signals: DuplicateAnalysisResult`：新版分析层产生的客观相似组信号。
  - `photos: PhotoItem[]`：当前的内存照片列表。
  - `userDecisions?: Record<string, 'keep' | 'review' | 'delete'>`（可选）：用户的历史决断缓存。
- **出参设计**：
  - `similarGroups: SimilarGroup[]`：匹配 Context 与 Photo Battle 状态机所需的数据格式。

### 2. 转换基本原则
- **不修改 photos**：转换过程仅产生新的 `SimilarGroup[]` 集合，绝对禁止直接写入或修改传入 `photos` 列表的任何属性。
- **无状态与文案改写**：禁止在此函数中产生 `status` 决策以及 `displayLabel` / `reasonLabel` 等中文 UI 文字。
- **结构兼容**：通过 `photoToGroup` 及 `signals.groups` 完美导出 `recommendedPhotoIds`、`backupPhotoIds`、`cullCandidateIds` 和 `undecidedPhotoIds`，保持与现有 `activeBattle` 状态机的交互无缝对接。

---

## 四、 Context 分阶段接入步骤

为了确保零缺陷迁移，Context 接入新信号路径将划分为五个渐进阶段：

### Step 1：双路只读对比（当前已完成）
- 旧版 `detectDuplicates` 依旧全权驱动主流程与 `similarGroups` 的初始化。
- 新版 `buildDuplicateSignals` 仅并行运行并计算生成 QA 对比指标，在开发环境下日志审查是否对齐。

### Step 2：引入 `buildSimilarGroupsFromSignals`（当前已完成 - CORE-DUPLICATE-3）
- 实现了纯转换函数 `buildSimilarGroupsFromSignals`，将 `DuplicateAnalysisResult` 转换为不带 `battleUpdatedAt` 字段的 `SimilarGroupSignalForBattle[]` 结构，保持了绝对的纯净性，不调用 `Date.now()`、不改写 `photos`、无中文文案。
- 在 `PhotoWorkspaceContext.tsx` 的 `runDuplicateQA` 中，对处理完毕的照片列表进行无副作用 of 同步旧相似组数据还原（不修改或重构已有的 `initializeSimilarGroups` 主流程代码）。
- 调用 `newSimilarGroupsForQA = buildSimilarGroupsFromSignals(newResult)` 并计算其与旧相似组在组数、落入的分组照片总数上的差异，将其扩展记录于 `DuplicateSignalComparison` 比对摘要中。
- 主流程与 A/B PK、结果页、ZIP 导出依旧纯净地由旧版相似组驱动，`newSimilarGroupsForQA` 绝不流入用户流程。

### Step 2.1：QA 命名与注释收敛（当前已完成 - CORE-DUPLICATE-3.1）
- 将 `SimilarGroupSignalForBattle` 重命名为 `QASimilarGroupSignalForBattle`，从命名语义上物理斩断其与正式 Photo Battle 主流程的任何误用关联。
- 对 `duplicateSignalResult` 状态定义、`newSimilarGroupsForQA` 局部变量添加了显式的危险操作警示与隔离注释，禁止任何 UI 组件或导出程序越权读取。
- 确认此改动不涉及任何运行逻辑更改。

### Step 3：Context 双路保存 `similarGroups`（当前已完成 - CORE-DUPLICATE-4）
- 在 `PhotoWorkspaceContext.tsx` 中新增了 `duplicateGroupQA` 只读调试状态并对外暴露。
- 状态中持久化保存了从旧逻辑同步克隆出的 `oldSimilarGroupsForQA` 数组、从新版纯信号生成的 `newSimilarGroupsForQA` 数组与两路比对指标 `comparison`。
- 字段均加上了严格的隔离警告声明，确保正式 similarGroups 继续完全独立地驱动主流程，不发生任何流程切换。

### Step 4：灰度切换开关引入（当前已完成 - CORE-DUPLICATE-5）
- 新建了 `src/lib/config/featureFlags.ts` 并声明灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`，配备了完备的安全注释。
- 本轮未在 Context 或任何正式运行代码中 import 该开关，未启用 true 分支，主流程和 QA 物理比对数据依然独立运行。

### Step 4.1：灰度开关 true 分支接入规划（当前已完成 - CORE-DUPLICATE-6-PLANNING）
- 规划了 `true` 分支开启时如何接入 signal-derived similarGroups，并重申其必须受 development-only 双重条件保护。
- **唯一合法路径规范**：新版客观相似信号（Similarity Group Signal）进入正式 Battle 的唯一合法路径必须是：
  `buildDuplicateSignals` 
  → `buildSimilarGroupsFromSignals` 
  → Context 中的 `similarGroups` 状态（仅在 `development` 且开关为 `true` 时由 Context 控制注入）
  → `Photo Battle` / results 页面渲染。
  **绝对禁止**信号直接越过 Context 进入 results、ZIP 导出或 UI 视图。

### Step 4.2：Feature Flag 常量读取与安全防护（当前已完成 - CORE-DUPLICATE-6）
- 在 Context 中正式完成了灰度开关的读取，且建立了 development-only 条件防护。
- **当前状态**：新版相似组客观信号（signal groups）由于开关默认关闭（`false`）尚未成为正式 Battle 的数据源。
- **未来要求**：即使后期需要在本地进行开启测试，也必须在本地小批量图片与指标完全一致的情况下才允许手动打开 true 分支，未来 true 分支合并前必须继续执行多轮严格的回归 QA 验证。

### Step 5：正式切换与老方案拔除
- 前置条件达成后（Demo 及本地导入测试均未发现 group 漂移，A/B 对局功能及 ZIP 导出均 100% 通过），将开关永久设为 `true`。
- 安全从 Context 中卸载 `detectDuplicates`，并从 `duplicate.ts` 中彻底抹去关于 `status` / `displayLabel` 等副作用写入。

---

## 五、 数据字段兼容性

为防止数据状态漂移，需要贯彻以下兼容细节：
1. **标识稳定性**：`photo.id` 是系统内定位照片的唯一核心。`DuplicateAnalysisResult.photoToGroup` 必须能绝对精准地根据 `photo.id` 寻址。
2. **Leader 仅仅是参考**：客观相似组信号中推荐的 `leaderId`（基于客观清晰度与综合物理分计算得出）只作为 Photo Battle 的初始推荐保留者，用户的显式决断（`userDecision`）在任何时候均具有最高支配权。
3. **跳过（Skip）处理**：当用户在 Photo Battle 中选择“跳过”某组对局时，该组不能落入最终的 `delete` 分区，需重置回 `undecidedPhotoIds`，重新回到“需要 PK”列表，不引入第三种用户状态。

---

## 六、 风险控制与 QA 指标

### 1. 潜在风险点
- **组数量（group count）漂移**：因为连通分量计算微调导致分组数或组员出现错位，进而引发 Photo Battle 对局数改变。
- **LeaderId 漂移**：质量排序极度微小的变化导致算法推荐的 leader 不一致。虽然不破坏用户决策，但会改变对局中左右图片的初始推荐站位。
- **性能挑战**：连通分量图的组装与转换是 $O(n^2)$ 复杂度，必须控制大批量图片（1000张以上）分析时的响应时间。
- ** needsBattle 照片漏判风险**：未 PK 的相似照片不可直接当作 keep 导出，ZIP 安全导出模块必须维持严密的安全警示。

### 2. 回归 QA 指标
在接下来的每一次重构阶段，必须定量审查如下指标是否完美对齐：
- `oldGroupCount` 与 `newGroupCount` 的一致性。
- `oldGroupedPhotoCount` 与 `newGroupedPhotoCount`（落入相似组的照片总数）的一致性。
- `leaderMismatchCount`（推荐组长 ID 不匹配数）应为 0。
- `memberMismatchCount`（组内成员不一致数）应为 0。
- `groupId` 的分配连续性与稳定性。
- A/B PK 能否正常在 UI 自动激活，且 ZIP 导出安全提示无误。

---

## 七、 当前不做的内容

本轮及后续规划中**绝对不修改**以下内容以隔离风险：
- 不在主流程中替换 `detectDuplicates` 的调用。
- 不将 Photo Battle 数据源切换到新信号。
- 不改写 results 页面的渲染逻辑和 ZIP 导出的底层逻辑。
- 不调整现有的感知哈希算法（dHash）和汉明距离判定阈值（10）。
- 不引入 OpenCV、PIL 或第三方图像哈希包等额外体积。
- 不支持 HEIC 及 RAW 原生图片格式。
