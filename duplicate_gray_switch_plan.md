# AI Photo Cleaner 相似组灰度切换规划 - CORE-DUPLICATE-5-PLANNING

## 一、 当前双路状态

项目中目前并行运行着两套完全隔离的相似照片检测与分组处理机制：

### 1. 旧正式主流程 (Legacy Path)
- **处理链路**：由 `detectDuplicates` 处理 `photos`（具有直接改写照片状态、中文文案的副作用） → `initializeSimilarGroups` 初始化 `similarGroups`。
- **影响范围**：实际驱动整理页面 `/results` 的展示分区、`Photo Battle` A/B 对局状态机（`activeBattle` 队列）以及 ZIP 安全导出包分区。
- **现状**：为当前线上用户所感知和使用的唯一数据源。

### 2. 新 QA 流程 (QA Path)
- **处理链路**：由 `buildDuplicateSignals` 提取客观哈希分组信号 → `buildSimilarGroupsFromSignals` 纯函数转换为兼容的组结构 → Context 内部调试状态 `duplicateGroupQA` 存储双路快照与对比指标。
- **影响范围**：仅用作开发模式下的双路只读 QA 校验与回归分析。
- **现状**：处于绝对的物理隔离状态，不被任何 UI 视图组件、状态机或 ZIP 导出消费，不影响用户任何操作。

---

## 二、 灰度开关设计

为了在后期能够平滑过渡到分析层与状态/决策解耦的物理分层架构，我们规划在项目中引入一个核心 feature flag 灰度切换开关：

```typescript
export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;
```

### 1. 核心灰度原则
- **默认极值必须为 `false`**：在正式发布的代码中，开关常量的默认值必须保持为 `false`，确保主流程由成熟稳定的旧路径驱动。
- **测试隔离**：仅允许在本地开发环境（`process.env.NODE_ENV === "development"`）或明确的回归 QA 测试分支中将此开关手动改为 `true` 进行验证。
- **生产静默与回退能力**：生产环境绝对不直接默认开启此灰度开关。一旦线上发生任何未预期的聚类错位或崩溃，必须能够通过回滚此常量开关为 `false` 立刻恢复 legacy 主流程。
- **用户意志绝对优先**：灰度开关启用与否，仅改变相似组推荐 Leader 与对决队列的初始状态。用户的显式决断（`userDecision`）在任何时候依然保留最高优先级，且最终的分类体系依旧二值收敛为“保留”与“淘汰候选”。

---

## 三、 开关建议物理位置

为了保持代码的可维护性与模块化：
- **不建议**将其直接暴露在已经十分臃肿的 `PhotoWorkspaceContext.tsx` 中。
- **建议**在项目中新建一个 feature flags 专用配置文件：
  ```
  src/lib/config/featureFlags.ts
  ```
- **配置结构示例**：
  ```typescript
  // =========================================================================
  // FEATURE FLAGS CONFIGURATION
  // =========================================================================
  
  /**
   * 灰度切换开关：控制是否使用新版纯客观信号（SimilarityGroupSignal）驱动相似组 Battle。
   * - false (默认): 继续使用旧的 detectDuplicates + legacy similarGroups 驱动主流程，确保稳定向后兼容。
   * - true: 使用 buildDuplicateSignals + buildSimilarGroupsFromSignals 驱动 Photo Battle，供开发期 QA 测试。
   */
  export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;
  ```
*(注：本规划阶段不创建此文件，本轮不改写任何 React/TypeScript 源码)*

---

## 四、 灰度开关控制行为

在 Context 的初始化与对局重置位置，逻辑分支规划如下：

```typescript
import { USE_SIGNAL_GROUPS_FOR_BATTLE } from '@/lib/config/featureFlags';

// ...
if (USE_SIGNAL_GROUPS_FOR_BATTLE) {
  // 灰度分支：使用客观相似检测信号生成的 newSimilarGroupsForQA 覆盖 similarGroups 状态，
  // 驱动 Photo Battle 状态机和对战。
} else {
  // 稳定分支：继续使用 legacy 相似组逻辑来初始化和驱动
}
```

启用 `true` 分支时必须贯彻的红线要求：
1. ** results 页面**：分区卡片绘制、像素诊断与 needsBattle 警示正常。
2. ** Photo Battle**：擂台平移、缩放、回合判定和自动跳过流程工作无阻。
3. ** ZIP 安全导出**：导出分区复用 `getUserVisibleBucket` 逻辑依旧准确，保持一致性。
4. **分类体系**：依然只有“保留”和“淘汰候选”，不存在“复核”、“未决定”或“删除”等被废弃的用户分类。

---

## 五、 灰度切换前置验收标准

在正式切换此 Feature Flag 为 `true` 驱动正式流程前，必须全数达成以下指标：
- **Demo 数据完全对齐**：`oldGroupCount === newGroupCount` 且 `oldGroupedPhotoCount === newGroupedPhotoCount`。
- **组长对齐**：`leaderMismatchCount === 0`，保证客观清晰度与综合算分算法做出的 Leader 推荐完全一致。
- **性能达标**：在导入本地 1000 张以上大批量图片时，感知哈希连通分量图处理与相似组转换不能引发浏览器卡顿或未响应。
- **Photo Battle 状态闭环**：擂台可自动被激活，比对结果能完美归入对应物理区，且跳过对局能重回待 PK。
- **零日志污染**：在生产环境（production）构建中，无任何 QA 对比日志或错误 warn 信息输出。
- **零误用风险**：`duplicateGroupQA` 字段绝对没有被任何 React UI 视图误用或越权消费。
- **构建守卫**：`npm run build` 和 `npm run lint` 通过无阻。

---

## 六、 潜在切换风险与安全回退策略

### 1. 核心切换风险
- **分组拓扑漂移**：因为连通图 BFS 深度微弱差异造成分组数错位，直接导致对决轮次数量变动。
- **未 PK 照片误导出**：如果主流程切换时状态判定出错，造成 needsBattle 相似图在未 PK 完时被打包进“保留”区，需要安全导出模块拦截保护。
- **O(n²) 级图搜索卡死**：连通分量邻接表在极端复杂相似关系下递归栈溢出，未来应做好广度优先层数硬截断保护。

### 2. 回退与安全策略
- **开关一键切回**：一旦测试分支有故障或主流程异常，直接回滚 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `false` 即可秒级切回原有稳定逻辑，提供最可靠的兜底。
- **导出强阻断警示**：如果用户相似照片未 PK 完即触发导出，依然展示警示弹窗，建议完成后再导出。

---

## 七、 后续重构步骤与 Checkpoint 规划

1. **`CORE-DUPLICATE-5` (灰度开关集成 - 当前已完成)**：
   - 新建了 `src/lib/config/featureFlags.ts` 并在其中定义了 `USE_SIGNAL_GROUPS_FOR_BATTLE = false` 且配备了详细的安全注释，本轮未进行任何代码逻辑接入，主流程完全不变。
2. **`CORE-DUPLICATE-5-QA` (开关安全检查 - 下一阶段)**：
   - 建议让 Codex 只读检查，确保开关默认值绝对为 `false`，且没有任何业务文件（如 Context 或 Battle 等）非预期 import 该开关。
3. **`CORE-DUPLICATE-6-PLANNING` (灰度逻辑接入设计 - 当前已完成)**：
   - 规划了 `true` 分支如何安全地接入并驱动 Photo Battle。
   - 确立了 `true` 分支必须受到 development-only 强保护，生产环境（production）下自动闭锁。
   - 本轮未改写任何 React/TypeScript 运行代码，主流程及灰度开关默认值仍继续保持为 `false`。
4. **`CORE-DUPLICATE-6` (Feature Flag 逻辑集成与保护 - 当前已完成)**：
   - 引入 feature flag 常量读取与 `canUseSignalGroupsForBattle` 逻辑，加入 `process.env.NODE_ENV === "development"` 限制保护。
   - Feature flag 已开始被 Context 读取，但默认值为 `false`，生产环境（production）下强制退回 legacy 分支，确保稳定不变，主流程与原来完全等价。
5. **`CORE-DUPLICATE-6-QA` (双路分支安全只读审查 - 当前已完成)**：
   - Codex 只读检查 true 分支是否受到 development-only 强阻断保护，确认 false 分支行为与旧版主流程完全等价。
6. **`CORE-DUPLICATE-7-PLANNING` (灰度测试规划 - 当前已完成)**：
   - 新增了 `duplicate_true_branch_test_plan.md`。
   - 确立了灰度开关临时测试规范：默认 `false`，本地 development 环境临时 `true` 测试，测试完毕立刻归位 `false`，绝不提交 `true`，也绝不 push `true` 的默认值。
   - 确立了 灰度开关临时测试规范：默认 `false`，本地 development 环境临时 `true` 测试，测试完毕立刻归位 `false`，绝不提交 `true`，也绝不 push `true` 的默认值。
7. **`CORE-DUPLICATE-7` (本地灰度开发调试 - 当前已完成)**：
   - 本地临时将开关改为 `true` 进行测试流转，记录 Demo 与小批量图片的一致性。测试结束后已将其彻底恢复为 `false`，不提交 `true` 默认值。
8. **`CORE-DUPLICATE-7-QA` (灰度测试回归 - 当前已完成)**：
   - 针对 Photo Battle、ZIP 导出以及多回合重置数据流进行深度定量分析与回归。
9. **`CORE-DUPLICATE-8-PLANNING` (类型适配与本地图片测试规划 - 当前已完成)**：
   - 规划了 `adaptSignalGroupsToLegacySimilarGroups` 类型适配方案以及 20-50 张非隐私本地图片的灰度测试细节。
10. **`CORE-DUPLICATE-8` (类型适配逻辑实现 - 当前已完成)**：
    - 新增并导出了显式纯类型适配器 `adaptSignalGroupsToLegacySimilarGroups`，并在 Context 的 true 灰度分支里调用其接收 signal-derived groups，成功移除了 `as unknown as SimilarGroup[]` 强转。

---

## 八、 开关临时实测结果

- **Demo 验证情况**：临时在本地开发环境手动开启 `true` 后，Demo 旅行照片集测试顺利跑通所有流程，双路校验的组数、总张数及 Leader 推荐 100% 对齐。
- **状态恢复**：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认 `false`。
- **限值保护约束**：在小批量本地非敏感照片测试尚未完成前，绝不允许将此开关默认启用为 `true`。
- **技术债与灰度状态**：类型强转的技术债务已在灰度切换前彻底消除，但 Feature Flag 配置常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 在代码中仍然强制默认为 `false`，确保生产环境绝对稳定。
- **技术债处理约束**：在 true 分支全量合并和扩大测试前，必须首先解决类型强转的编译安全隐患，不允许长期依赖 `as unknown as SimilarGroup[]` 强转。

## 九、 CORE-DUPLICATE-9-PLANNING 进展更新与实测结果

本轮 `CORE-DUPLICATE-9-PLANNING` 完成了对 20-50 张非隐私本地图片的 true 分支灰度回归测试的规划，并在项目根目录下新建了 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
- **灰度开关状态**：灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然强制为 `false`，生产环境依旧强制使用 legacy。本轮未进行任何 src 代码改动。
- **本地图片测试前置**：在未来下一阶段 `CORE-DUPLICATE-9` 执行本地图片回归测试时，将遵循“即测即回”的原则，测试结束后必须立刻物理恢复为 `false`。

## 十、 CORE-DUPLICATE-9 实测状态与开关控制

- 小批量 true 测试通过后，开关已恢复 false。
- 默认 false 仍必须保持。
- 中批量测试通过前，不允许默认启用 true。

## 十一、 CORE-DUPLICATE-10-PLANNING 进展更新

本轮 `CORE-DUPLICATE-10-PLANNING` 已在项目根目录新建了 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
- **灰度开关硬性约束**：灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 必须继续默认强制为 `false`。即使在未来的中批量本地图片测试中，也必须遵循“即测即恢复 false”的规范，禁止把 `true` 的默认值提交或推送。

---

# AI Photo Cleaner 相似组灰度切换规划 - CORE-DUPLICATE-5-PLANNING

## 一、 当前双路状态

项目中目前并行运行着两套完全隔离的相似照片检测与分组处理机制：

### 1. 旧正式主流程 (Legacy Path)
- **处理链路**：由 `detectDuplicates` 处理 `photos`（具有直接改写照片状态、中文文案的副作用） → `initializeSimilarGroups` 初始化 `similarGroups`。
- **影响范围**：实际驱动整理页面 `/results` 的展示分区、`Photo Battle` A/B 对局状态机（`activeBattle` 队列）以及 ZIP 安全导出包分区。
- **现状**：为当前线上用户所感知和使用的唯一数据源。

### 2. 新 QA 流程 (QA Path)
- **处理链路**：由 `buildDuplicateSignals` 提取客观哈希分组信号 → `buildSimilarGroupsFromSignals` 纯函数转换为兼容的组结构 → Context 内部调试状态 `duplicateGroupQA` 存储双路快照与对比指标。
- **影响范围**：仅用作开发模式下的双路只读 QA 校验与回归分析。
- **现状**：处于绝对的物理隔离状态，不被任何 UI 视图组件、状态机或 ZIP 导出消费，不影响用户任何操作。

---

## 二、 灰度开关设计

为了在后期能够平滑过渡到分析层与状态/决策解耦的物理分层架构，我们规划在项目中引入一个核心 feature flag 灰度切换开关：

```typescript
export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;
```

### 1. 核心灰度原则
- **默认极值必须为 `false`**：在正式发布的代码中，开关常量的默认值必须保持为 `false`，确保主流程由成熟稳定的旧路径驱动。
- **测试隔离**：仅允许在本地开发环境（`process.env.NODE_ENV === "development"`）或明确的回归 QA 测试分支中将此开关手动改为 `true` 进行验证。
- **生产静默与回退能力**：生产环境绝对不直接默认开启此灰度开关。一旦线上发生任何未预期的聚类错位或崩溃，必须能够通过回滚此常量开关为 `false` 立刻恢复 legacy 主流程。
- **用户意志绝对优先**：灰度开关启用与否，仅改变相似组推荐 Leader 与对决队列的初始状态。用户的显式决断（`userDecision`）在任何时候依然保留最高优先级，且最终的分类体系依旧二值收敛为“保留”与“淘汰候选”。

---

## 三、 开关建议物理位置

为了保持代码的可维护性与模块化：
- **不建议**将其直接暴露在已经十分臃肿的 `PhotoWorkspaceContext.tsx` 中。
- **建议**在项目中新建一个 feature flags 专用配置文件：
  ```
  src/lib/config/featureFlags.ts
  ```
- **配置结构示例**：
  ```typescript
  // =========================================================================
  // FEATURE FLAGS CONFIGURATION
  // =========================================================================
  
  /**
   * 灰度切换开关：控制是否使用新版纯客观信号（SimilarityGroupSignal）驱动相似组 Battle。
   * - false (默认): 继续使用旧的 detectDuplicates + legacy similarGroups 驱动主流程，确保稳定向后兼容。
   * - true: 使用 buildDuplicateSignals + buildSimilarGroupsFromSignals 驱动 Photo Battle，供开发期 QA 测试。
   */
  export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;
  ```
*(注：本规划阶段不创建此文件，本轮不改写任何 React/TypeScript 源码)*

---

## 四、 灰度开关控制行为

在 Context 的初始化与对局重置位置，逻辑分支规划如下：

```typescript
import { USE_SIGNAL_GROUPS_FOR_BATTLE } from '@/lib/config/featureFlags';

// ...
if (USE_SIGNAL_GROUPS_FOR_BATTLE) {
  // 灰度分支：使用客观相似检测信号生成的 newSimilarGroupsForQA 覆盖 similarGroups 状态，
  // 驱动 Photo Battle 状态机和对战。
} else {
  // 稳定分支：继续使用 legacy 相似组逻辑来初始化和驱动
}
```

启用 `true` 分支时必须贯彻的红线要求：
1. ** results 页面**：分区卡片绘制、像素诊断与 needsBattle 警示正常。
2. ** Photo Battle**：擂台平移、缩放、回合判定和自动跳过流程工作无阻。
3. ** ZIP 安全导出**：导出分区复用 `getUserVisibleBucket` 逻辑依旧准确，保持一致性。
4. **分类体系**：依然只有“保留”和“淘汰候选”，不存在“复核”、“未决定”或“删除”等被废弃的用户分类。

---

## 五、 灰度切换前置验收标准

在正式切换此 Feature Flag 为 `true` 驱动正式流程前，必须全数达成以下指标：
- **Demo 数据完全对齐**：`oldGroupCount === newGroupCount` 且 `oldGroupedPhotoCount === newGroupedPhotoCount`。
- **组长对齐**：`leaderMismatchCount === 0`，保证客观清晰度与综合算分算法做出的 Leader 推荐完全一致。
- **性能达标**：在导入本地 1000 张以上大批量图片时，感知哈希连通分量图处理与相似组转换不能引发浏览器卡顿或未响应。
- **Photo Battle 状态闭环**：擂台可自动被激活，比对结果能完美归入对应物理区，且跳过对局能重回待 PK。
- **零日志污染**：在生产环境（production）构建中，无任何 QA 对比日志或错误 warn 信息输出。
- **零误用风险**：`duplicateGroupQA` 字段绝对没有被任何 React UI 视图误用或越权消费。
- **构建守卫**：`npm run build` 和 `npm run lint` 通过无阻。

---

## 六、 潜在切换风险与安全回退策略

### 1. 核心切换风险
- **分组拓扑漂移**：因为连通图 BFS 深度微弱差异造成分组数错位，直接导致对决轮次数量变动。
- **未 PK 照片误导出**：如果主流程切换时状态判定出错，造成 needsBattle 相似图在未 PK 完时被打包进“保留”区，需要安全导出模块拦截保护。
- **O(n²) 级图搜索卡死**：连通分量邻接表在极端复杂相似关系下递归栈溢出，未来应做好广度优先层数硬截断保护。

### 2. 回退与安全策略
- **开关一键切回**：一旦测试分支有故障或主流程异常，直接回滚 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `false` 即可秒级切回原有稳定逻辑，提供最可靠的兜底。
- **导出强阻断警示**：如果用户相似照片未 PK 完即触发导出，依然展示警示弹窗，建议完成后再导出。

---

## 七、 后续重构步骤与 Checkpoint 规划

1. **`CORE-DUPLICATE-5` (灰度开关集成 - 当前已完成)**：
   - 新建了 `src/lib/config/featureFlags.ts` 并在其中定义了 `USE_SIGNAL_GROUPS_FOR_BATTLE = false` 且配备了详细的安全注释，本轮未进行任何代码逻辑接入，主流程完全不变。
2. **`CORE-DUPLICATE-5-QA` (开关安全检查 - 下一阶段)**：
   - 建议让 Codex 只读检查，确保开关默认值绝对为 `false`，且没有任何业务文件（如 Context 或 Battle 等）非预期 import 该开关。
3. **`CORE-DUPLICATE-6-PLANNING` (灰度逻辑接入设计 - 当前已完成)**：
   - 规划了 `true` 分支如何安全地接入并驱动 Photo Battle。
   - 确立了 `true` 分支必须受到 development-only 强保护，生产环境（production）下自动闭锁。
   - 本轮未改写任何 React/TypeScript 运行代码，主流程及灰度开关默认值仍继续保持为 `false`。
4. **`CORE-DUPLICATE-6` (Feature Flag 逻辑集成与保护 - 当前已完成)**：
   - 引入 feature flag 常量读取与 `canUseSignalGroupsForBattle` 逻辑，加入 `process.env.NODE_ENV === "development"` 限制保护。
   - Feature flag 已开始被 Context 读取，但默认值为 `false`，生产环境（production）下强制退回 legacy 分支，确保稳定不变，主流程与原来完全等价。
5. **`CORE-DUPLICATE-6-QA` (双路分支安全只读审查 - 当前已完成)**：
   - Codex 只读检查 true 分支是否受到 development-only 强阻断保护，确认 false 分支行为与旧版主流程完全等价。
6. **`CORE-DUPLICATE-7-PLANNING` (灰度测试规划 - 当前已完成)**：
   - 新增了 `duplicate_true_branch_test_plan.md`。
   - 确立了灰度开关临时测试规范：默认 `false`，本地 development 环境临时 `true` 测试，测试完毕立刻归位 `false`，绝不提交 `true`，也绝不 push `true` 的默认值。
   - 确立了 灰度开关临时测试规范：默认 `false`，本地 development 环境临时 `true` 测试，测试完毕立刻归位 `false`，绝不提交 `true`，也绝不 push `true` 的默认值。
7. **`CORE-DUPLICATE-7` (本地灰度开发调试 - 当前已完成)**：
   - 本地临时将开关改为 `true` 进行测试流转，记录 Demo 与小批量图片的一致性。测试结束后已将其彻底恢复为 `false`，不提交 `true` 默认值。
8. **`CORE-DUPLICATE-7-QA` (灰度测试回归 - 当前已完成)**：
   - 针对 Photo Battle、ZIP 导出以及多回合重置数据流进行深度定量分析与回归。
9. **`CORE-DUPLICATE-8-PLANNING` (类型适配与本地图片测试规划 - 当前已完成)**：
   - 规划了 `adaptSignalGroupsToLegacySimilarGroups` 类型适配方案以及 20-50 张非隐私本地图片的灰度测试细节。
10. **`CORE-DUPLICATE-8` (类型适配逻辑实现 - 当前已完成)**：
    - 新增并导出了显式纯类型适配器 `adaptSignalGroupsToLegacySimilarGroups`，并在 Context 的 true 灰度分支里调用其接收 signal-derived groups，成功移除了 `as unknown as SimilarGroup[]` 强转。

---

## 八、 开关临时实测结果

- **Demo 验证情况**：临时在本地开发环境手动开启 `true` 后，Demo 旅行照片集测试顺利跑通所有流程，双路校验的组数、总张数及 Leader 推荐 100% 对齐。
- **状态恢复**：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认 `false`。
- **限值保护约束**：在小批量本地非敏感照片测试尚未完成前，绝不允许将此开关默认启用为 `true`。
- **技术债与灰度状态**：类型强转的技术债务已在灰度切换前彻底消除，但 Feature Flag 配置常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 在代码中仍然强制默认为 `false`，确保生产环境绝对稳定。
- **技术债处理约束**：在 true 分支全量合并和扩大测试前，必须首先解决类型强转的编译安全隐患，不允许长期依赖 `as unknown as SimilarGroup[]` 强转。

## 九、 CORE-DUPLICATE-9-PLANNING 进展更新与实测结果

本轮 `CORE-DUPLICATE-9-PLANNING` 完成了对 20-50 张非隐私本地图片的 true 分支灰度回归测试的规划，并在项目根目录下新建了 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
- **灰度开关状态**：灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然强制为 `false`，生产环境依旧强制使用 legacy。本轮未进行任何 src 代码改动。
- **本地图片测试前置**：在未来下一阶段 `CORE-DUPLICATE-9` 执行本地图片回归测试时，将遵循“即测即回”的原则，测试结束后必须立刻物理恢复为 `false`。

## 十、 CORE-DUPLICATE-9 实测状态与开关控制

- 小批量 true 测试通过后，开关已恢复 false。
- 默认 false 仍必须保持。
- 中批量测试通过前，不允许默认启用 true。

## 十一、 CORE-DUPLICATE-10-PLANNING 进展更新

本轮 `CORE-DUPLICATE-10-PLANNING` 已在项目根目录新建了 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
- **灰度开关硬性约束**：灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 必须继续默认强制为 `false`。即使在未来的中批量本地图片测试中，也必须遵循“即测即恢复 false”的规范，禁止把 `true` 的默认值提交或推送。

---

## 十二、 CORE-DUPLICATE-10 中批量测试结论与开关复位

- **开关状态确认**：测试已结束，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认极值 `false`，无任何 true 脏代码残留。
- **仿真测试通过**：中批量 200 张仿真/元数据 true 分支测试已通过，两路算法分组一致性对齐无偏。
- **准入红线强调**：
  - 本轮测试为**仿真元数据测试**，并不等于真实 100-300 张大图读取、Canvas 分析、主线程渲染与 ZIP 导出的压力测试。
  - **元数据仿真测试通过绝对不等于 production 生产准入。** 灰度开关默认强制为 `false` 这一安全红线必须继续坚守。
- 下一步必须规划真实 100-300 张物理图片文件的压力测试，在此之前，绝对禁止在生产环境或作为默认主流程启用。

---

## 十三、 CORE-DUPLICATE-11-PLANNING 进展更新

- **开关安全规范**：在规划和未来的真实 100-300 张图片文件压力测试中，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 也必须在测试期间严格遵循“即测即恢复 false”的规范。
- **生产环境限制**：无论测试表现如何，production 环境依然绝对禁止启用 `true` 分支，主流程始终强锁定为 legacy。

---

## 十四、 CORE-DUPLICATE-11 真实图片测试结论与开关复位

- **开关状态确认**：测试已结束，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认极值 `false`，无任何 true 脏代码残留。
- **实测通过**：真实 100/200/300 张 BMP 文件 true 分支测试已通过，双路分组算法对齐，未发生任何逻辑死锁或崩溃。
- **生产与测试隔离边界**：
  - 本轮测试仅覆盖小尺寸 24-bit 无压缩 BMP，不能代表 JPG / PNG / WebP 压缩解码或 RAW / HEIC 及手机大图的瓶颈。
- **production 生产环境仍绝对禁止启用 true**。扩大测试前必须继续分档进行大批量或混合格式物理图片测试。

---

## 十五、 CORE-DUPLICATE-12-PLANNING 进展更新

- **开关安全规范**：在规划和未来的 JPG / PNG / WebP 混合格式真实图片测试中，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 必须在测试期间严格遵循“即测即恢复 false”的规范。
- **生产环境限制**：无论测试表现如何，production 环境依然绝对禁止启用 `true` 分支，主流程始终强锁定为 legacy。

---

## 十六、 CORE-DUPLICATE-12-ABORT-DOCS 进展更新

- **开关状态确认**：测试已安全中止，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认极值 `false`，无任何 true 脏代码残留。
- **生产与测试隔离边界**：
  - production 环境依然绝对禁止启用 `true` 分支。
  - 在 JPG / PNG / WebP 混合格式测试完全稳定通过前，绝对不得扩大 `true` 灰度开关的使用范围。

## 十七、 CORE-DUPLICATE-12-RETRY-PLANNING 进展更新

- **重试开关原则**：在未来的混合格式重试（RETRY）期间，`USE_SIGNAL_GROUPS_FOR_BATTLE` 常量必须继续遵循“即测即恢复 false”的极值限制，测试结束后无条件改回 `false`。
- **生产锁死**：生产环境（production）依然 100% 锁死在 legacy 分支，确保主流程的稳定性和后向兼容性。
- **CORE-DUPLICATE-12-RETRY 实测结论**：本轮 100 张混合格式 retry 压测后，开发环境下的灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已立即安全恢复为默认值 `false`，保证代码仓库无 `true` 配置残留。在混合格式大批量 200 张与 300 张等更广维度测试完全稳定跑通前，`true` 灰度开关绝不允许在生产环境（production）启用，生产环境依旧 100% 被 legacy 稳定主流程强制锁死。


