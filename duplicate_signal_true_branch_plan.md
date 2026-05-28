# AI Photo Cleaner Signal Groups true 分支接入规划 - CORE-DUPLICATE-6-PLANNING

## 一、 当前状态

当前项目中已经基本具备了解耦与双路验证所需的所有基石组件：
- **`legacy detectDuplicates`**：遍历 `photos` 并直接在对象上进行状态、中文文案的副作用改写（当前驱动主流程的绝对依赖）。
- **`legacy similarGroups`**：由 `initializeSimilarGroups` 直接初始化（用于驱动 results 页面与对决状态机）。
- **`buildDuplicateSignals`** 与 **`buildSimilarGroupsFromSignals`**：纯客观信号提取和转换函数（保持绝对纯净，不写照片状态，无 Date.now()）。
- **`duplicateSignalResult`** 与 **`duplicateGroupQA`**：Context 内部的 dev-only / QA-only 只读调试状态，存储双路快照及比对摘要。
- **`USE_SIGNAL_GROUPS_FOR_BATTLE = false`**：硬编码配置 Feature Flag，声明在 `src/lib/config/featureFlags.ts` 中。
- **运行代码现状**：Context 等业务代码没有 import 该开关，亦不含任何 if 分支，正式主流程依旧由旧数据源全权驱动。

---

## 二、 未来 true 分支目标

当将灰度控制开关设为 `true`（`USE_SIGNAL_GROUPS_FOR_BATTLE === true`）且仅限于开发环境时，允许通过客观信号转换出来的相似组数据暂时驱动 Photo Battle 进行真实流转测试。
在生产环境（production）构建中，开关必须强制走 `false` 稳定分支，严禁开启。

---

## 三、 true 分支接入位置与限制条件

### 1. 建议接入位置
未来开关代码将物理集成于 [PhotoWorkspaceContext.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/context/PhotoWorkspaceContext.tsx) 中。当执行照片分析完成、载入 Demo 照片、或重置擂台对局时，在初始化 `similarGroups` 的地方根据 Feature Flag 执行数据流重定向：

```typescript
import { USE_SIGNAL_GROUPS_FOR_BATTLE } from '@/lib/config/featureFlags';

// ...
const canUseSignalGroups = 
  process.env.NODE_ENV === "development" && 
  USE_SIGNAL_GROUPS_FOR_BATTLE === true;

if (canUseSignalGroups) {
  // 灰度分支：使用新信号 buildSimilarGroupsFromSignals 生成的转换结果覆盖类似组状态，驱动 PK
} else {
  // 稳定分支：继续调用 legacy initializeSimilarGroups 流程
}
```

### 2. Development-only 强保护原则
即使在代码中将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 常量改写为 `true`，我们也将在 Context 逻辑中利用 `process.env.NODE_ENV === "development"` 进行运行时保护阻断。在打包生产环境（production）发布包时，该灰度通道自动闭锁，物理强制退回 legacy 稳定分支，保护线上用户的交互与结果绝对安全。

---

## 四、 true 分支下的数据流向规划

灰度开关启用 `true` 时，相似照片整理的唯一合法接入路径必须遵循如下单向流动：

```
[客观图片分析] 
  -> duplicate.ts (buildDuplicateSignals) -> 产生客观信号 DuplicateAnalysisResult
  -> duplicate.ts (buildSimilarGroupsFromSignals) -> 转化为兼容格式 QASimilarGroupSignalForBattle[]
  -> Context (similarGroups) -> 仅在 canUseSignalGroups 为 true 时装载入正式对局状态
  -> results 页面 / Photo Battle 状态机 -> 从 Context 正常读取类似组以渲染 UI 和对局
```

- **绝对禁止** results 页面、PK 状态机组件直接 import 新版转换函数或直接读取 `duplicateGroupQA` 只读字段。它们必须统一从 Context 现有的 `similarGroups` 状态中消费数据。
- **ZIP 导出**：始终复用 UI Mapping 层的 `getUserVisibleBucket` 逻辑，数据依然流向“保留”与“淘汰候选”二值分类包，未受灰度干扰。
- **用户决断优先**：Photo Battle 阶段的用户点击（如“保留左图”、“两张都保留”）以及手动 status 订正将直接覆盖任何算法产生的 Leader 指标，意志绝对优先。

---

## 五、 false 分支回退容灾策略

稳定分支（`USE_SIGNAL_GROUPS_FOR_BATTLE === false`）是系统的生命线。
- **快速切回**：一旦在 `true` 分支下发生对局死锁、页面空白或任何逻辑漂移，测试人员只需要在配置文件 `featureFlags.ts` 中一键改写 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `false` 即可秒级切回。
- **无感还原**：回退过程不需要修改 Context 或 results 等其他源码，且绝对不会影响用户的照片列表状态和 ZIP 导出文件。

---

## 六、 灰度切换前置 QA 验收标准

在允许将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 极值置为 `true` 开展本地对局测试前，必须确保如下指标全数通过：

### 1. 定量 QA 数据表现
- **Demo 数据组数与成员对齐**：`oldSimilarGroupCount === newSimilarGroupCount` 且 `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`，不匹配数（mismatch）必须为 0。
- **Leader 对齐**：`leaderMismatchCount === 0`，保证算分排序完全无偏。

### 2. 本地物理多维度校验
- **小批量测试（20-50张）**：能够顺利跑通 Canvas 分析，卡片渲染、对局擂台能自动弹出，且淘汰候选无死锁。
- **中批量测试（100-300张）**：浏览器无任何渲染延迟，开发环境日志简洁明了不刷屏。
- **大批量测试（500张以上）**：对连通图 O(n²) 搜索进行性能摸底，若有明显卡顿则禁止开启 `true` 通道。

### 3. 系统红线约束
- 生产构建（production）绝对不输出 QA 日志，亦不响应 `true` 变量。
- `duplicateGroupQA` 调试状态未被 UI 消费。
- “需要 PK”作为中间队列，不被暴露为用户最终分类。
- 物理编译（build）与 lint 检查完全通过。

---

## 七、 禁忌事项

未来 CORE-DUPLICATE-6 代码编写及测试时，严禁触碰以下红线：
- **绝对禁止**在 results 页面与 Photo Battle 组件中直接引用客观信号与转换逻辑。
- **绝对禁止**在 ZIP 导出流程中跨过 Context 去直接读取 `duplicateGroupQA` 的指标。
- **绝对禁止**相似组信号生成逻辑包含 `status` 修改或中文文案（`displayLabel` / `reasonLabel`）写入。
- **绝对禁止**在生产包（production）中开启 `true` 灰度灰度分支。

---

## 八、 后续 Checkpoint 路线

1. **`CORE-DUPLICATE-6` (Feature Flag 开关集成 - 当前已完成)**：
   - 引入 feature flag 常量读取与 canUseSignalGroupsForBattle 逻辑，加入 `process.env.NODE_ENV === "development"` 限制保护。
   - 默认极值保持为 `false`，生产环境强制走 legacy。因为当前 `USE_SIGNAL_GROUPS_FOR_BATTLE === false`，所以最终的运行结果依然走 legacy 稳定主流程。
2. **`CORE-DUPLICATE-6-QA` (双路分支安全只读审查 - 当前已完成)**：
   - Codex 只读检查 true 分支是否受到 development-only 强阻断保护，确认 false 分支行为与旧版主流程完全等价。
3. **`CORE-DUPLICATE-7-PLANNING` (本地测试流程规划 - 当前已完成)**：
   - 新建了 `duplicate_true_branch_test_plan.md`，深度规划了 `true` 分支小批量本地测试流程。
   - 强调 `true` 只能本地 `development` 环境临时测试，测试结束后必须立刻恢复为 `false`，绝不把 `true` 默认值提交到远程仓库。
4. **`CORE-DUPLICATE-7` (本地灰度开发调试 - 当前已完成)**：
   - 本地将开关改为 `true` 进行测试流转，记录 Demo 与小批量图片的一致性。测试结束后已恢复 `false` 默认值，不提交 `true` 默认值。
5. **`CORE-DUPLICATE-7-QA` (灰度测试回归 - 当前已完成)**：
   - 针对 Photo Battle、ZIP 导出以及多回合重置数据流进行深度定量分析与回归，确认无异常。
6. **`CORE-DUPLICATE-8-PLANNING` (本地图片测试与类型适配规划 - 当前已完成)**：
   - 规划了 20-50 张非隐私本地图片 true 分支测试方案。
   - 规划了 `adaptSignalGroupsToLegacySimilarGroups` 显式类型适配器，用于彻底拔除 `as unknown as SimilarGroup[]` 强转技术债。
7. **`CORE-DUPLICATE-8` (类型适配逻辑实现 - 当前已完成)**：
   - 新增显式类型适配器 `adaptSignalGroupsToLegacySimilarGroups` 并定义 `SimilarGroupCompatible` 接口，在 Context 初始化 true 分支里彻底移除了 `as unknown as SimilarGroup[]` 强转，由适配器在编译期保障类型安全性。

---

## 九、 CORE-DUPLICATE-7 实测状态

- **Demo 实测结果**：在 `true` 灰度分支下，Demo 数据集的双路校验 100% 对齐一致，所有对决、跳过、重置与 ZIP 导出流程均通过验证。
- **本地图片测试状态**：小批量本地图片尚未测试。
- **结论限制**：由于本地图片集尚未进行测试验证，当前结论不能扩大到真实本地图片集。
- **后续方向**：随着类型适配的完毕，后续应正式执行 20-50 张本地非隐私图片的 true 灰度分支测试（`CORE-DUPLICATE-7` 本地回归测试阶段）。

## 十、 CORE-DUPLICATE-9-PLANNING 进展更新

本轮 `CORE-DUPLICATE-9-PLANNING` 已经制定了 20-50 张非隐私本地图片 true 分支的灰度回归测试方案，并新建了专门的测试清单文档 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
- **测试状态说明**：下一步在下一轮 `CORE-DUPLICATE-9` 执行测试，当前仍保持默认 `false` 极值，无 src 代码改动。

## 十一、 CORE-DUPLICATE-9 测试验证结果

- true 分支已完成小批量 35 张非隐私图片测试。
- 测试通过，但不代表可扩大启用。
- 下一步应规划 100-300 张中批量测试。

## 十二、 CORE-DUPLICATE-10-PLANNING 进展更新

本轮 `CORE-DUPLICATE-10-PLANNING` 已规划 100-300 张中批量测试并新建了专门的测试规划文档 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
- **测试状态与启用限制**：true 分支在中批量测试通过前，仍不能默认启用，主流程在默认配置下依然强锁定 legacy 方案。

---

## 十三、 CORE-DUPLICATE-10 中批量元数据测试通过

- **元数据仿真测试已完成**：已执行并通过了中批量 200 张仿真元数据 true 分支测试。
- **parity 数据**：组数 15/15，照片数 60/60，组长不匹配数为 0。
- **性能耗时**：31.55 ms ~ 36.07 ms（属于极速元数据仿真级别）。
- **生产与默认极值限制**：
  - 本轮测试为**纯仿真/元数据测试**，并不等于真实 200 张大图读取、解析、Canvas 诊断、UI 网格重绘以及 ZIP 打包压缩等物理压力测试。
  - 开关状态已恢复：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为 `false`。
  - 接入限制：**true 分支仍绝对禁止在 production 生产环境或作为默认主流程启用。** 下一步必须规划真实 100-300 张物理图片文件的压力测试以验证主线程瓶颈。

---

## 十四、 CORE-QA-PARITY-2 与 CORE-DUPLICATE-SIGNAL-SWITCH-PLANNING 进展更新

- **真实混合格式回归通过**：利用新增的 `window.__AI_PHOTO_CLEANER_QA__` 作为稳定的读取通道，已在 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 临时开启下，成功通过了 100 张和 300 张真实 JPG / PNG / WebP 混合格式物理图片测试，双路算法结果数据（老新组数、相似照片数）在当前回归中稳定一致，领队错配数为 0，滚动性能良好，无第三分类产生。
- **生产不暴露与灰度限制**：生产包已通过防污染拦截守卫，`typeof window.__AI_PHOTO_CLEANER_QA__` 确认返回 `undefined`。由于目前尚未在真实的客户海量复杂相册以及 RAW / HEIC 等格式下进行深度实测，该 true 分支目前仅建议作为开发环境下的手动灰度（development-only 灰度测试），生产环境已锁定在 legacy 机制，并由 production 验证未暴露该全局对象。

---

## 十五、 CORE-DUPLICATE-REALISTIC-ALBUM-PLANNING 进展更新

- **真实相册感样本测试规划**：已在项目根目录下新建了 [duplicate_realistic_album_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_realistic_album_test_plan.md) 规划更贴近手机真实相册的 100-300 张非隐私样本测试。
- **状态与主流程约束**：
  - 测试不再是 500+ 的盲目数量压测，而是通过在项目目录外构建真实感照片集以提高样本多样性，且严禁隐私泄漏、HEIC/RAW 暂不纳入。
  - 正式主流程仍由 legacy 稳定驱动，生产环境禁止启用 true 灰度分支，测试时临时 true，测试结束后必须恢复 `false`。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。



