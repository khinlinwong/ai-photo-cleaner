# AI Photo Cleaner Context 双路 similarGroups QA 保存规划 - CORE-DUPLICATE-4-PLANNING

## 一、 当前状态

当前 Context 中正式主流程和整理结果的生成依旧被旧版相似分组路径完全垄断与隔离：

1. **`detectDuplicates`** 遍历并修改 `photos` 列表（含有 `status` 决策和 `displayLabel` / `reasonLabel` 中文文案等副作用）。
2. **`initializeSimilarGroups`** 依据 `detectDuplicates` 处理后的照片状态，生成正式的 `similarGroups` 状态存储。
3. **`results/page.tsx`** 页面展现、自动 PK 对决（`Photo Battle` 状态机与 `activeBattle` 队列）以及 ZIP 导出分区均强依赖此正式 `similarGroups`。
4. **`buildDuplicateSignals`** 与 **`buildSimilarGroupsFromSignals`** 在本阶段仅用于开发模式（development）下的只读双路 QA 校验，其计算产生的新相似组只作为局部变量在 `runDuplicateQA` 内部生存，未写入任何 Context state 状态。

---

## 二、 下一步目标 (CORE-DUPLICATE-4)

CORE-DUPLICATE-4 的核心目标是：**在 Context 中引入双路 QA 分组数据的运行时持久化，而不影响任何现有的用户交互流程。**

未来我们将同时维护：
- **正式驱动源**：正式 `similarGroups` 状态（由旧版逻辑初始化，继续驱动前端 UI、PK 对决及 ZIP 导出）。
- **只读 QA 双路数据**：在 Context 中保存 `oldSimilarGroupsForQA` 和 `newSimilarGroupsForQA` 用于在更复杂的运行时环境下（如经历多回合 Battle 操作和状态重置后）进行深入的对比分析。

---

## 三、 Context 字段与命名规划

为了实现安全隔离，建议在 `PhotoWorkspaceContext.tsx` 中定义如下专用 QA 状态对象，并以 **dev-only / QA-only** 的语义和命名暴露：

```typescript
export interface DuplicateGroupQAState {
  oldSimilarGroupsForQA: LegacySimilarGroupShape[];
  newSimilarGroupsForQA: QASimilarGroupSignalForBattle[];
  comparison: DuplicateSignalComparison;
  updatedAt?: string; // 仅由调用方运行时生成，buildSimilarGroupsFromSignals 仍不得调用 Date.now()
}

// 在 PhotoWorkspaceContextType 接口中声明
duplicateGroupQA?: DuplicateGroupQAState;
```

### 1. 严格的隔离注释警告
代码集成时必须在 Context Type 和 state 实例化上方声明如下严厉的警告注释：

```typescript
// =========================================================================
// CRITICAL DEV-ONLY QA WARNING:
// - duplicateGroupQA, oldSimilarGroupsForQA and newSimilarGroupsForQA
//   are strictly Dev-only QA fields for regression testing.
// - DO NOT under any circumstances use these fields to drive UI, Results page,
//   Photo Battle flow, ZIP export, or user-visible decisions.
// =========================================================================
```

---

## 四、 双路保存规则与更新机制

在 CORE-DUPLICATE-4 中：

1. **`similarGroups` (正式状态)**：
   - 保持现状，继续由旧的 `initializeSimilarGroups` 生成和驱动。
2. **`oldSimilarGroupsForQA` (只读旧数据)**：
   - 在 `runDuplicateQA` 运行时，同步克隆并还原旧版的分组，结构上与 `QASimilarGroupSignalForBattle` 兼容以保障精确比对。
3. **`newSimilarGroupsForQA` (只读新信号)**：
   - 由 `duplicateSignalResult` 经 `buildSimilarGroupsFromSignals` 纯函数生成。
4. **`comparison` (对比器)**：
   - 对比两路生成的组总数差异（`similarGroupCountMismatch`）。
   - 对比两路涵盖的照片成员数差异（`similarGroupedPhotoCountMismatch`）。
   - 对比两路推荐 Leader 的 ID 一致性（`leaderMismatchCount`）。
   - （可选）对比两路成员 ID 的交集分布，找出可能的分组漂移偏差。

---

## 五、 禁止事项与质量红线

CORE-DUPLICATE-4 仍然禁止执行以下操作：
- **绝对禁止**将 `newSimilarGroupsForQA` 写入正式的 `similarGroups` 状态。
- **绝对禁止**让 `newSimilarGroupsForQA` 或 `oldSimilarGroupsForQA` 进入 `activeBattle` 对局队列。
- **绝对禁止**让 `/results` 页面展示或消费 `duplicateGroupQA` 数据（即便未来实现 `true` 分支，也绝对不允许 results 页面直接读取 `duplicateGroupQA`）。
- **绝对禁止**让 ZIP 导出模块依据 `duplicateGroupQA` 的任何指标划分包内容（即便未来实现 `true` 分支，也绝对不允许 ZIP 导出直接读取 `duplicateGroupQA`）。
- **绝对禁止**改动汉明距离阈值（10）或篡改感知哈希判定规则。
- **绝对禁止**将完整照片实体对象、图片 Base64 或本地图片物理路径输出到控制台日志中。

---

## 六、 开发期 QA 对比日志规范

运行时对比日志仅在开发环境下简洁输出：

```typescript
if (process.env.NODE_ENV === "development") {
  console.debug("[Duplicate SimilarGroups QA]", {
    oldSimilarGroupCount: duplicateGroupQA.oldSimilarGroupsForQA.length,
    newSimilarGroupCount: duplicateGroupQA.newSimilarGroupsForQA.length,
    oldSimilarGroupedPhotoCount,
    newSimilarGroupedPhotoCount,
    leaderMismatchCount: duplicateGroupQA.comparison.leaderMismatchCount,
    similarGroupCountMismatch: duplicateGroupQA.comparison.similarGroupCountMismatch,
    similarGroupedPhotoCountMismatch: duplicateGroupQA.comparison.similarGroupedPhotoCountMismatch
  });
}
```

- **禁止刷屏**：仅在分析完毕或重置 PK 时单次输出。
- **禁止包含敏感数据**：不输出图片物理属性与照片名，仅输出纯数字指标摘要。
- **生产环境静默**：生产环境绝对不进行任何比对日志输出。

---

## 七、 后续重构步骤与 Checkpoint

我们将在后续的重构开发中按如下步骤小步推进：

### 1. `CORE-DUPLICATE-4` (Context 双路保存 - 当前已完成)
- 在 Context 中新增了 `duplicateGroupQA` 只读调试状态，同步计算并保存了 `oldSimilarGroupsForQA`（不调用 `Date.now()` 的轻量 mock 数组）、`newSimilarGroupsForQA` 与比对指标 `comparison`。
- 正式 `similarGroups` 状态驱动维持 100% 独立不变，确保主流程百分百向后兼容。

### 2. `CORE-DUPLICATE-4-QA` (双路保存只读审查)
- Codex 进行只读性审查，确保 results 页面及 Battle 没有任何对新 QA 数据源的依赖。
- 确认开发日志摘要无错漏，评估在复杂 PK 重置状态下的两路一致性。

### 3. `CORE-DUPLICATE-5-PLANNING` (灰度切换规划 - 当前已完成)
- 新增项目根目录文档 `duplicate_gray_switch_plan.md`，深度规划了灰度切换开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 的物理位置、行为机制以及回退和安全策略。
- 确认当前不修改任何业务和 React 代码，主流程和 QA 只读性质继续维持不变。

### 4. `CORE-DUPLICATE-5` (灰度开关集成 - 当前已完成)
- 建立了 Feature Flag 常量定义文件，声明并导出了 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`。
- 本轮未在任何运行代码中进行 import，Context 仍未读取该开关。`duplicateGroupQA` 仍然只是只读 QA 数据，正式 similarGroups 依然驱动 UI 和 Battle 主流程。

### 5. `CORE-DUPLICATE-6-PLANNING` (灰度开关 true 分支接入规划 - 当前已完成)
- 规划了未来开关为 `true` 时的重定向路径，明确了 `duplicateGroupQA` 仍是只读的 dev-only QA 数据。
- 即使未来实现了 `true` 分支，也绝对不允许 results 页面或 ZIP 导出直接读取 `duplicateGroupQA` 字段，一切必须通过 Context 的 `similarGroups` 统一流转。
- 本轮未改动任何 React / TypeScript 源码。

### 6. `CORE-DUPLICATE-6` (Feature Flag 开关集成 - 当前已完成)
- 在 Context 中正式读取了灰度开关，并添加了 `canUseSignalGroupsForBattle` 的 development-only 强条件校验。
- 确认 `duplicateGroupQA` 仍然只是只读的 dev-only QA 数据，未在任何 UI 或导出模块中消费。
- 当前由于开关默认关闭，正式的 `similarGroups` 对局数据源依然走的是 legacy 旧流程，主流程逻辑完全没有改变。
