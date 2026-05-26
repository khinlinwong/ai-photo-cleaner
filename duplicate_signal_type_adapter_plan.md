# AI Photo Cleaner Signal Groups 类型适配规划 - CORE-DUPLICATE-8-PLANNING

## 一、 当前问题

当前 true 分支虽然受到 `USE_SIGNAL_GROUPS_FOR_BATTLE = false` 和 development-only guard 的双重保护，但在编译层面为了解决类型匹配问题，采用了类型强转：
```typescript
setSimilarGroups(signalGroups as unknown as SimilarGroup[]);
```

这种处理方式存在以下技术债和潜在风险：
1. **绕过类型保护**：`as unknown as SimilarGroup[]` 强行抹平了 TypeScript 的静态类型安全检查，使得后续一旦数据结构发生不兼容变动，编译器无法在编译期进行预警拦截。
2. **运行时对局崩溃风险**：如果 signal 派生转换出来的字段实际上不完整（例如缺失了 Photo Battle 擂台对决所需的某个状态属性），状态机在读取该属性时可能会发生 `undefined` 错误，引发运行时崩溃或擂台逻辑死锁。
3. **分层原则违背**：没有做到明确的适配器物理分层，把转换和适配模糊在一起。

因此，在未来正式化与全量合并前，必须设计显式、安全的类型适配函数来取代这一临时强转，保障系统高内聚、低耦合的特性。

---

## 二、 目标类型适配函数规划

规划在未来重构阶段中，设计一个专门用于衔接客观分析信号与前端 React 擂台交互模型的纯适配函数：

- **建议名称**：`adaptSignalGroupsToLegacySimilarGroups`
- **函数职责**：把 `QASimilarGroupSignalForBattle[]`（或 `DuplicateAnalysisResult`）显式、安全地转换为 Context 与 Photo Battle 所需的正式 `SimilarGroup[]` 数据结构。
- **纯度原则**：
  - 不修改任何 `photos` 列表属性。
  - 不篡改照片的业务状态 `status`。
  - 不包含 `displayLabel` 与 `reasonLabel` 等中文文案写入。
  - 不决定任何保留与淘汰候选的直接判定倾向。
  - **仅负责数据拓扑的显式转换与字段补全**。
  - 用户的最终决断依然在 Photo Battle 阶段手动操作时产生，并覆盖此初始适配推荐。

---

## 三、 适配字段映射设计

适配函数在执行重映射时，必须根据正式 `SimilarGroup` 类型定义显式生成并对齐以下全部字段：

1. **`id` / `groupId`**：相似组的唯一字符串标识。
2. **`photoIds`**：落入该相似组的照片 ID 集合数组（`string[]`）。
3. **`recommendedPhotoIds`**：初始推荐保留的照片 ID 集合。
   - 一般取该组内客观清晰度与质量综合评分最高者（即 `leaderId`）。
4. **`backupPhotoIds`**：该组内除推荐保留者之外的其他备选照片 ID 集合。
5. **`cullCandidateIds`**：初始化时必须显式置为空数组 `[]`，后续通过用户在 Photo Battle 中的真实表决来装载淘汰候选。
6. **`undecidedPhotoIds`**：初始化时该组的全体成员 ID 集合数组，用于在擂台未完成时标识待 PK 照片。
7. **`battleCompleted`**：初始布尔值强制设定为 `false`。
8. **`battleUpdatedAt`**：对局更新物理时间戳。
   - **时间戳隔离规则**：为了不破坏客观分析与转换纯函数的无副作用原则，`battleUpdatedAt` 属性在调用 `buildSimilarGroupsFromSignals` 时不可包含。它可以由本适配函数在执行转换时，通过参数传入一个固定的 `fixedTimestamp`，或者在 Context 装载 `similarGroups` 状态时使用 `Date.now()` 等运行时函数来显式填充，从而保持核心转换逻辑的绝对纯净与无副作用。

---

## 四、 去除类型强转推进步骤

为了稳妥地拔除 `as unknown as SimilarGroup[]` 这一类型债务，各项步骤推进如下：

- **Step 1：只读确认字段 (已完成)**：确认了 `SimilarGroup` 的全部必填字段，包括 `battleUpdatedAt: number`。
- **Step 2：新增显式适配器 (已完成 - CORE-DUPLICATE-8)**：在 `src/lib/analysis/local/duplicate.ts` 中编写并导出了 `adaptSignalGroupsToLegacySimilarGroups` 适配函数及 `SimilarGroupCompatible` 类型。
- **Step 3：无强转安全接入 (已完成 - CORE-DUPLICATE-8)**：在 Context `initializeSimilarGroups` 的 true 分支中，用 `adaptSignalGroupsToLegacySimilarGroups(signalGroups, Date.now())` 彻底替代了 `as unknown as SimilarGroup[]` 强转，消除了强转技术债。
- **Step 4：Codex 只读审查 (当前阶段)**：
  - 确认强转已完全移除，已无 `as unknown as SimilarGroup[]` 残留。
  - 确认当前 Feature Flag 开关极值依然为 `false`，主流程安全未变。
- **Step 5：小批量本地测试回归 (下一阶段)**：重新在开发环境手动开启进行 20-50 张非隐私本地图片测试。
