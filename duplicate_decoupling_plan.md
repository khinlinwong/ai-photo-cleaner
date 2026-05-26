# AI Photo Cleaner 相似检测解耦规划 - CORE-DUPLICATE-PLANNING-1

## 一、 当前问题

当前相似检测模块 `duplicate.ts` 在原型开发阶段承担了过多的非客观分析职责。目前它可能同时参与：
- 计算图像的 perceptualHash / dHash。
- 计算汉明距离并评估相似度。
- 归纳生成相似照片组，并设置 `duplicateGroupId`。
- 推荐组内最佳照片 (groupLeader)。
- **直接修改底层照片状态 `status`**（例如将非推荐图标为 `delete` 或 `review`）。
- **生成业务文案 `displayLabel` 与 `reasonLabel`**（向 Context 传递中文提示词）。
- **直接决定并污染了用户的最终可见分类**。

这些职责深度耦合在一起，使得算法逻辑与业务状态逻辑高度绑定，产生了较高的维护风险。

---

## 二、 目标职责

在分层稳定化架构中，未来重构后的 `duplicate.ts` 将仅作为 **分析层 (Analysis Layer)** 的一部分，只进行客观的计算：

### 1. 应该负责的客观检测：
- 接收照片的基础分析结果与元数据。
- 提取或读取照片的感知哈希指纹（如 `dHash`/`pHash`）。
- 计算图像指纹的汉明距离（Hamming distance）。
- 输出相似照片组及每组照片的 ID 数组。
- 输出组内的哈希距离或相似度指标。
- 依据物理质量得分，可选输出 `groupLeader` 指针作为后续决策的技术参考。

### 2. 绝对不应承担的职责：
- **修改用户最终状态 (`status`)**。
- **决定照片是保留还是标记为淘汰候选**。
- **输出任何中文业务文案（包括直接写入 `displayLabel` / `reasonLabel`）**。
- **干预 Photo Battle 的用户选择状态**。
- **直接影响 ZIP 安全导出的物理 bucket 划分**。

---

## 三、 未来输出类型规划

重构后，`duplicate.ts` 的接口应当设计为返回如下的纯结构体：

```typescript
type SimilarityGroupSignal = {
  groupId: string;
  photoIds: string[];
  leaderId?: string;
  averageDistance?: number;
  minDistance?: number;
  maxDistance?: number;
  method: "dHash" | "pHash" | "aHash" | "mixed";
};

type DuplicateAnalysisResult = {
  groups: SimilarityGroupSignal[];
  photoToGroup: Record<string, string>;
};
```
*注：这些只是未来的重构规划类型，本轮不会新建任何 TypeScript 代码文件。*

---

## 四、 职责拆分与分层流向

未来相似检测与用户决策的分层数据流向规划如下：

1. **`duplicate.ts` (分析层)**
   - 提取客观信号，仅输出 `SimilarityGroupSignal`。
   - 不修改照片状态。
2. **`photoDecision.ts` (决策层)**
   - 接收 `SimilarityGroupSignal`。
   - 当检测到相似关系时，自动生成建议状态 `needsBattle`，并装载英文代号 `similarGroup`。
   - 不输出任何中文文案，且用户手动选择（`userDecision`）时以最高优先级覆盖该建议。
3. **`photoLabelMapping.ts` (UI 派生层)**
   - 将 `needsBattle` 翻译为“需要 PK”，将 `cullCandidate` 翻译为“淘汰候选”。
   - 将 `similarGroup` 翻译为“相似照片”。
4. **`PhotoWorkspaceContext` (用户决定层)**
   - 仅作为内存状态存储中心，管理 `photos` 列表、`similarGroups`、`activeBattle` 队列以及用户操作结果，不承载任何 UI 文字与翻译。
5. **`results/page.tsx` (UI 展现层)**
   - 仅读取 UI Mapping 层导出的翻译结果，挂载擂台比对状态和导出控制，不直接调用或执行相似度计算。

---

## 五、 后续重构步骤

为了控制重构风险，我们将该部分的重构拆分为如下五个微小步骤逐步推进：

### 1. `CORE-DUPLICATE-READ-1`
- 仅只读检查当前 `duplicate.ts` 的源码结构、内部状态干预及 diff 点，评估潜在的聚类偏移。
- **本步不做任何代码层面的修改**。

### 2. `CORE-DUPLICATE-1` (已完成)
- 新增并导出了纯相似组信号提取函数 `buildDuplicateSignals`，及其依赖的 `DuplicateSignalInput`, `SimilarityGroupSignal`, `DuplicateAnalysisResult` 等类型。
- 纯函数逻辑仅输出客观相似组的映射，没有向照片实体写入 `status` / `displayLabel` / `reasonLabel` 中文文案与状态判断，保持了其纯净性。
- 保留了旧的 `detectDuplicates` 函数与全部主流程依赖以确保百分百向后兼容。

### 3. `CORE-DUPLICATE-2` (已完成)
- 重构了 `PhotoWorkspaceContext.tsx`，在图片分析完成、导入演示数据、重置擂台对局三处位置，并行双路调用旧的 `detectDuplicates` 和新的 `buildDuplicateSignals`。
- 通过新增的 `compareOldAndNewDuplicates` 方法自动分析比对两路的分组数量、分组内照片总数、推荐 Leader 的 ID 是否匹配，以辅助验证算法的一致性。
- 开发环境下通过 `console.debug` 输出简洁比对摘要，且本步骤绝不替换或改变用户主流程，没有对用户结果 and ZIP 导出造成任何影响。

### 3.1. `CORE-DUPLICATE-2.1` (已完成)
- 完成了 QA 双路生成机制的开发期安全收敛：
  - 在 `PhotoWorkspaceContext.tsx` 中将 `duplicateSignalResult` 字段标注为 dev-only QA 专用，添加明确注释，防止后续 UI、results、Photo Battle 和 ZIP 导出意外误用。
  - 限制 `runDuplicateQA` 异常分支的 `console.warn` 仅在开发环境下输出，避免在 production 环境泄露 QA 错误日志。
  - 维持旧 `detectDuplicates` 驱动主流程的逻辑不变。

### 3.2. `CORE-DUPLICATE-3-PLANNING` (已完成)
- 新建了 `duplicate_signal_integration_plan.md` 接入路径规划文档。
- 确立了 Step 1 到 Step 5 的分阶段演进方案，规划了无副作用的转换工具 `buildSimilarGroupsFromSignals` 的输入输出及无中文文案原则。
- 细化了双路保存相似组、灰度开关控制、leaderId 兼容性、跳过对局处理以及 group count 漂移等风险 QA 回归指标。

### 4. `CORE-DUPLICATE-3` (已完成)
- 新增并导出了 `buildSimilarGroupsFromSignals` 纯转换函数（不包含 `Date.now()` 和其他副作用，保证完全纯净）。
- 在 `PhotoWorkspaceContext.tsx` 中实现了 `newSimilarGroupsForQA` 双路相似组信号数据生成并安全完成与旧相似组在分组总数、照片总数上的指标对比，扩展了 QA 开发日志。
- 主流程与 A/B PK、结果页、ZIP 导出依旧由旧版相似组完全驱动，主流程未发生改变。

### 4.1. `CORE-DUPLICATE-3.1` (已完成)
- 强化了 QA 兼容数据结构和状态的命名与注释收敛：
  - 将 `SimilarGroupSignalForBattle` 重命名为 `QASimilarGroupSignalForBattle`。
  - 在 Context 字段与局部变量定义处增加了高度醒目的隔离注释警告，以防止后续 UI / Photo Battle / ZIP 导出发生非预期的误接入。
  - 确认在正式引入灰度开关前，任何新信号所转化的 QASimilarGroup 数据都仅仅作为开发期回归只读对比，无法驱动主流程。

### 4.2. `CORE-DUPLICATE-4-PLANNING` (已完成)
- 新增了 `duplicate_context_dual_group_plan.md`，用于规划 Context 内部双路 `similarGroups` 对比数据的持久化存储方案。
- 规定了下一步开发时仅引入 dev-only QA 状态 `duplicateGroupQA` 进行双路比对数据的持久化与日志审查，不改变正式的 similarGroups 对局驱动源。

### 4.3. `CORE-DUPLICATE-4` (已完成)
- 在 `PhotoWorkspaceContext.tsx` 中新增并对外暴露了 `duplicateGroupQA` 只读状态。
- 状态中持久化保存了同步克隆得到的 `oldSimilarGroupsForQA` 数组、由客观新信号转换出的 `newSimilarGroupsForQA` 数组与比对摘要 `comparison`，并为其加上了严格的隔离警示注释。
- 旧 `detectDuplicates` 与旧 `similarGroups` 主流程数据流百分百维持不变，不改变用户流程。

### 4.4. `CORE-DUPLICATE-5-PLANNING` (已完成)
- 新增了 `duplicate_gray_switch_plan.md` 灰度切换规划文档。
- 确立了在独立配置文件中加入 `USE_SIGNAL_GROUPS_FOR_BATTLE` 的物理设计，制定了默认 `false` 保障兼容及局部开发测试 `true` 验证的流程。
- 规定了图算法在连通分组与 Leader 挑选时的全方位指标验收红线，以及双路回退容灾策略。
- 本轮未改写任何 src 代码，不改动主流程。

### 4.5. `CORE-DUPLICATE-5` (已完成)
- 新建了 Feature Flag 机制文件 `src/lib/config/featureFlags.ts`，导出并硬编码了 `USE_SIGNAL_GROUPS_FOR_BATTLE = false` 且带有严密的测试验收注释。
- 本轮未在 Context 或 results 页面等任何运行文件里 import 开关，未改变主流程。

### 4.6. `CORE-DUPLICATE-6-PLANNING` (已完成)
- 规划了 `true` 分支如何接入，将 `duplicate.ts` 解耦推进到了 true 分支规划阶段。
- 确认了 `duplicate.ts` 输出的新客观信号在灰度环境与稳定环境的逻辑隔离。
- 强调在进行正式替换前，必须经受多轮 QA，保障对局及 ZIP 导出的 100% 正确性。

### 4.7. `CORE-DUPLICATE-6` (已完成)
- 在 Context 中正式完成了灰度开关的读取，且建立了 development-only 条件防护。
- **声明**：`CORE-DUPLICATE-6` 本轮仅用于开关读取逻辑与安全逻辑的接入，并没有实际切换主流程。新客观信号转换的逻辑当前处于静默分支，依然使用 legacy 数据源驱动 Photo Battle，对用户流程完全无侵入。

### 5. `CORE-DUPLICATE-QA`
- 对重构后的系统进行全面校验，对比重构前后的相似分组数量、Photo Battle 流程闭环以及 ZIP 导出数据流，确保无异常。

---

## 六、 风险控制与质量要求

- **单步渐进**：`duplicate.ts` 是核心高风险文件，禁止一次性大面积物理重写。
- **测试守卫**：每次 checkpoint 改造完毕，都必须执行 `npm run build` 和 `npm run lint` 跑通编译，且本地测试 Demo 照片与本地导入文件夹流程正常，比对、导出 ZIP 完全符合预期。
- **相似组监控**：如果在解耦过程中，相似组的数量产生了任何变化，重构人员必须在第一时间排查并记录变化根源。

---

## 七、 当前不做的范围限制

在当前阶段，以下高级桌面版特性**绝对不在**本轮和后续重构开发范围内：
- 不引入 OpenCV 库。
- 不引入 PIL (Python Imaging Library) 图像处理库。
- 不引入 Python imagehash 计算。
- 不集成 Tauri 桌面外壳容器。
- 不集成 Rust sidecar / Python sidecar 本地多进程通信。
- 不支持 HEIC 及 RAW 格式照片。
- 不改动任何现有的感知哈希算法汉明距离阈值（不改变算法推荐敏锐度）。
- 不改动目前任何用户可见主工作流。
