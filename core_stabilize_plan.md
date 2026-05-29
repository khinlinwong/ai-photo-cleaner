# AI Photo Cleaner 核心逻辑稳定化规划 - CORE-STABILIZE-2

本规划旨在为 AI Photo Cleaner 从网页原型向稳定本地桌面软件过渡提供核心逻辑分层规划。当前 Next.js 浏览器原型已实现了核心的快速筛选工作流，但为了后续能无缝迁移至 Tauri + Rust 架构并确保代码的高内聚、低耦合，必须对现有的分析、决策、数据流和 UI 展示边界进行清晰的模块化拆分。

---

## 一、 稳定化目标

CORE-STABILIZE-2 的核心目标**不是引入新功能**，而是为未来的重构确立代码物理边界。

目前的代码中，共享上下文 `PhotoWorkspaceContext`、感知哈希聚类 `duplicate.ts` 和评分算法 `localScore.ts` 与前端 UI 展示逻辑、中文文案存在不同程度的耦合。为了实现长期的稳定性，未来稳定版系统将严格划分以下四层：
1. **分析层 (Analysis Layer)**：客观算力输出，无状态判断，无 UI 词汇。
2. **决策层 (Decision Layer)**：输出决策建议，不决定最终状态，不含中文文案。
3. **UI 派生层 (UI Mapping Layer)**：单向将内部建议翻译为用户可见的中文词汇和状态。
4. **用户决定层 (User Decision Layer)**：管理最终持久化分类，用户意志绝对优先于算法建议。

---

## 二、 分析层 (Analysis Layer)

### 1. 职责边界
分析层只负责客观物理信号的提取与计算，不带有任何关于用户分类的逻辑倾向。

- **可以做**：
  - 提取图片的焦距、边缘高频细节以评估清晰度。
  - 读取亮度、通道分布以评估曝光状态。
  - 计算图片的 dHash 或 perceptualHash (pHash)。
  - 对比哈希距离，输出相似照片组 (Similar Groups)。
  - 输出基础 Metadata（尺寸、文件大小、格式类型等）。
- **绝对禁止**：
  - 绝对禁止包含 `displayLabel` 或 `reasonLabel` 字段。
  - 绝对禁止包含任何中文 UI 提示词。
  - 绝对禁止直接设置或修改照片的最终归属状态。
  - 绝对禁止决定照片是应该“保留”还是“淘汰”。

### 2. 建议未来目录结构
```
src/lib/analysis/
  local/
    sharpness.ts        # 图像清晰度分析
    exposure.ts         # 图像曝光度分析
    duplicate.ts        # 相似/连拍分组聚类（仅输出相似组）
  scoring/
    localScore.ts       # 内部辅助综合质量评分
  decision/
    photoDecision.ts    # 决策层：生成建议
  ui/
    photoLabels.ts      # UI 派生层：中文文案翻译
```

### 3. 分析层输出数据示例
```typescript
type AnalysisSignal = {
  sharpnessScore: number;
  exposureScore: number;
  perceptualHash?: string;
  duplicateGroupId?: string;
  resolution: string;
  fileSizeBytes: number;
  riskFlags: {
    blur: boolean;
    exposure: boolean;
    similar: boolean;
  };
};
```

---

## 三、 决策层 (Decision Layer)

### 1. 职责边界
决策层充当分析信号与业务状态的翻译官，根据客观分析指标生成“内部倾向性建议”。

- **可以做**：
  - 根据清晰度得分和曝光偏差，建议将照片移入哪个倾向区。
  - 标识某张照片是否因为连拍相似需要进入 Photo Battle 比对。
  - 生成标准化的内部原因代号 (Reason Codes)。
- **绝对禁止**：
  - 绝对禁止包含任何中文 UI 文本。
  - 绝对禁止强行覆盖用户的显式操作决定。
  - 绝对禁止将建议状态作为最终且不可变更的数据状态。

### 2. 决策层核心定义与原则
- **优先度**：用户决定层 `userDecision` 优先于任何 status 或算法建议。
- **返回值建议**：
```typescript
type SuggestedBucket = "keep" | "cullCandidate" | "needsBattle";

type DecisionSuggestion = {
  suggestedBucket: SuggestedBucket;
  reasonCodes: Array<"userSelected" | "userCulled" | "similarGroup" | "blurRisk" | "exposureRisk" | "initialKeep">;
  confidence?: "low" | "medium" | "high";
};
```

---

## 四、 UI 派生层 (UI Mapping Layer)

### 1. 职责边界
UI 派生层属于前端纯展示层，负责以单向依赖的方式将决策层的内部代码、代号和建议转译为符合产品设计的高可读性中文标签。

- **可以做**：
  - 将 `SuggestedBucket` 映射为“保留”、“淘汰候选”和“需要 PK”（注意：在二值分类状态中，“需要 PK”临时作为 `keep` 在 `getUserVisibleBucket` 中呈现，防止误删，但 UI 必须提示用户）。
  - 将 `reasonCodes` 转换成“模糊候选”、“曝光异常”、“相似照片”、“用户选择”等中文 Badges。
  - 控制按钮的激活状态、安全导出的文案警告以及技术详情折叠区域的图表绘制。
- **绝对禁止**：
  - 绝对禁止直接修改状态机或 Context 内部的存储数据。
  - 绝对禁止越权计算照片的物理指标或直接判定照片是否相似。

### 2. UI 状态映射工具示例
```typescript
function getUserVisibleLabel(bucket: SuggestedBucket): string {
  switch (bucket) {
    case "keep":
      return "保留";
    case "cullCandidate":
      return "淘汰候选";
    case "needsBattle":
      return "需要 PK";
    default:
      return "待处理";
  }
}
```

---

## 五、 用户决定层 (User Decision Layer)

### 1. 职责边界
用户决定层负责记录并持久化用户的显式操作结果。

- **核心原则**：
  - **用户决定绝对优先**：一旦用户进行了手动标定（如点击“保留”、“淘汰候选”或在 A/B PK 中做出选择），算法建议即刻失效，一切以用户的最终意图为准。
  - **二值分类收敛**：用户可见的最终导出状态只有“保留”和“淘汰候选”。
  - **跳过规则**：跳过（Skip）操作仅仅是将比对回合推迟，不属于最终第三种状态。跳过的照片在内部保持待决状态。
- **用户指令支持**：
  - 保留左图
  - 保留右图
  - 两张都保留
  - 两张都标记为淘汰候选
  - 跳过当前组

---

## 六、 历史兼容策略 (review / delete 等遗留字段)

为了避免大范围重构引发的逻辑崩塌，针对当前原型代码中残留的 SaaS 过渡字段，我们采取以下逐步收敛策略：

1. **`review` / `undecided` 兼容**：
   底层仍可以使用 `review` 表示“初步筛选中”或“待 PK”，但 UI 层面应当将其统归入“需要 PK”或“初步保留”，不再对用户暴露这些技术词汇。
2. **`delete` 状态兼容**：
   底层代码中的 `status === 'delete'` 依然可以用作删除标记，但在所有的 UI 文案、按钮标签和导出 Zip 文件名上，必须统一映射显示为“淘汰候选”。
3. **`displayLabel` / `reasonLabel` 的移出**：
   在后续重构中，彻底把分析模块和 Context 内返回的 `displayLabel` 清理干净，改成在前端组件中通过 UI Mapping 派生生成，还分析算法层以纯净。
4. **`duplicate.ts` 的移出**：
   后续重构时需要调整 `duplicate.ts` 使其仅输出相似关系，不直接修改底层 status 等状态信息。

---

## 七、 后续重构路线图

后续的重构工作划分为以下几个 Checkpoints 进行：

### 1. `CORE-MAPPING-1` (UI 状态映射重构 - 已完成)
- 新建独立文件 `src/lib/utils/photoLabelMapping.ts`。
- 将 results 页面里的 `getUserVisibleBucket` 和 `getReasonTags` 移出到独立文件中。

### 2. `CORE-MAPPING-1.1` (UI 导出统一 - 已完成)
- 修正 `photoLabelMapping.ts` 的依赖方向，移除对 Context 的直接导入，改用轻量级 type。
- 统一 ZIP 导出分区规则，使其复用 `getUserVisibleBucket`。

### 3. `CORE-DECISION-1` (独立决策层引入 - 已完成)
- 创建 `src/lib/analysis/decision/photoDecision.ts`。
- 引入决策层逻辑，提供 `getDecisionSuggestion` 函数以输出客观的建议状态与代号，且此文件内不包含任何中文 UI 字眼。

### 4. `CORE-DECISION-1.1` (用户决定优先级与导出强化 - 当前已完成)
- 修正 `photoDecision.ts` 中 `userDecision` 判定逻辑使其成为最高优先级，能够覆盖默认状态和算法识别结果。
- 重写 results 导出文案提示，强化 needsBattle（未 PK 完照片）的建议警示。

### 5. `CORE-DUPLICATE-PLANNING-1` (相似聚类解耦规划 - 已完成)
- 规划了 `duplicate.ts` 相似检测逻辑与状态决策的物理拆分边界。
- 确立原则：`duplicate.ts` 后续仅归为分析层（Analysis Layer），只输出客观的相似组信号（`SimilarityGroupSignal`），不再向照片写入 `status` / `displayLabel` / `reasonLabel`。
- 确立决策映射规则：`needsBattle` 状态由决策层根据客观相似信号逻辑生成；中文“需要 PK”文本和翻译职责完全交由 UI Mapping 层的 `photoLabelMapping.ts` 接管。

### 6. `CORE-DUPLICATE-READ-1` (相似检测职责与风险只读分析 - 已完成)
- Codex 对当前 `duplicate.ts` 的代码职责进行了只读审查与 diff 分析，确认其当前处于正常运行状态，但明确了需要移出及可以保留的具体职能边界。

### 7. `CORE-DUPLICATE-1` (新增纯相似组信号函数 - 当前已完成)
- 在 `duplicate.ts` 中新增并导出了 `buildDuplicateSignals` 纯计算函数与相关类型，不写入照片任何 `status`、`suggestedStatus` 等业务分类，也不涉及任何中文文案和 `displayLabel`/`reasonLabel`。
- 保留旧有的 `detectDuplicates` 函数，当前主流程不发生任何实际生效的改变，提供安全的向后兼容保障。

### 8. `CORE-DUPLICATE-2` (双路生成对比 - 当前已完成)
- 在 `PhotoWorkspaceContext.tsx` 中实现了对旧版 `detectDuplicates` 与新版 `buildDuplicateSignals` 的双路生成，通过比对方法计算并在开发模式下用 `console.debug` 打印出了相似组对比摘要。本步骤完全不影响用户流程、状态机和导出，成功固化了双路校验层。

### 9. `CORE-DUPLICATE-2.1` (QA 双路安全收敛 - 当前已完成)
- 标注了 `duplicateSignalResult` 字段为 dev-only 专属，限制其绝不参与 UI、结果显示与 ZIP 导出流程。
- 限制 `runDuplicateQA` 异常分支的日志仅在开发阶段以 `console.warn` 输出，杜绝在生产中打印非必要 QA 日志。
- 在后续 `CORE-DUPLICATE-3` 规划实施前，继续确认并保持旧的 `detectDuplicates` 驱动主流程。

### 10. `CORE-DUPLICATE-3-PLANNING` (接入路径规划 - 当前已完成)
- 新增项目根目录文档 `duplicate_signal_integration_plan.md`，深度规划了新信号如何分阶段平滑接入 Context。
- 提出了 `buildSimilarGroupsFromSignals` 无副作用转换函数的设计，避免引入中文文案与状态污染。
- 细化了双路保存 `similarGroups` 对比验证、灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 的引入，并分析了潜在的 O(n²) 性能风险与 O(n) group 漂移风险。
- 本阶段完全未改动任何 React / JS 代码，主流程和 QA 字段性质均保持原封不动。

### 11. `CORE-DUPLICATE-3` (新增转换函数 - 当前已完成)
- 新增并导出了不使用 `Date.now()` 的 `buildSimilarGroupsFromSignals` 纯转换函数。
- 在 `PhotoWorkspaceContext.tsx` 中局部还原出旧相似组数据并在不改写主流程的前提下生成 `newSimilarGroupsForQA`，顺利计算出了双路分组长度与照片成员数对比差额，扩展了 QA 对比摘要指标。

### 12. `CORE-DUPLICATE-3.1` (QA 命名与注释收敛 - 当前已完成)
- 将旧的兼容类型 `SimilarGroupSignalForBattle` 重命名为 `QASimilarGroupSignalForBattle`，明确了 QA 专用的语义隔离。
- 强化了 Context 暴露的 `duplicateSignalResult` 属性 and `newSimilarGroupsForQA` 局部变量的隔离注释与警告声明，防范主流程代码、结果渲染及 ZIP 导出非预期误用。
- 双路分析数据仅作调试校验，不属于正式产品模型，旧路径驱动主流程保持不变。

### 13. `CORE-DUPLICATE-4-PLANNING` (双路保存规划 - 当前已完成)
- 新建了 `duplicate_context_dual_group_plan.md` 规划文档，制定了双路 `similarGroups` 对比数据在 Context 中持久化存储的接口（`duplicateGroupQA`）与规则。
- 确立了隔离警告规范、调试对比日志标准，并重申了 O(n²) 性能与 needsBattle 导出兜底等红线规范。
- 本轮只撰写规划文档，未改动任何业务和 React 源码。

### 14. `CORE-DUPLICATE-4` (双路保存实现 - 当前已完成)
- 在 `PhotoWorkspaceContext.tsx` 中实现了只读的 `duplicateGroupQA` 调试状态并对外暴露。
- 状态中运行时保存了还原出的 `oldSimilarGroupsForQA`、转换出的 `newSimilarGroupsForQA` 及比对摘要 `comparison`，完成了比对数据的持久化，并且未对主流程做任何改动。

### 15. `CORE-DUPLICATE-4-QA` (双路保存只读审查 - 当前已完成)
- Codex 完成了只读审查，确认 `duplicateGroupQA` 仅作为开发期 QA 只读调试状态，results 视图、PK 对局与 ZIP 导出未对其产生任何引用依赖，且主流程构建正常。

### 16. `CORE-DUPLICATE-5-PLANNING` (灰度切换规划 - 当前已完成)
- 新增项目根目录文档 `duplicate_gray_switch_plan.md`，深度规划了 `USE_SIGNAL_GROUPS_FOR_BATTLE` 开关控制架构。
- 规定了在 `src/lib/config/featureFlags.ts` 中声明灰度开关、默认极值保持为 `false` 以确保兼容性、在 QA 验收前禁止切换主流程、以及一键开关回退容灾策略。

### 17. `CORE-DUPLICATE-5` (灰度开关集成 - 当前已完成)
- 在 `src/lib/config` 下创建了 `featureFlags.ts` 配置文件，导出并硬编码声明了 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`，配有详细的 QA 限制说明。
- 未把此开关接入任何 Context 和整理逻辑，主流程维持原状。

### 18. `CORE-DUPLICATE-5-QA` (开关隔离只读审查 - 当前已完成)
- 经 Codex 进行只读性审查，确保 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值绝对为 `false`，无非预期的业务引用。

### 19. `CORE-DUPLICATE-6-PLANNING` (true 分支接入规划 - 当前已完成)
- 规划了 `true` 分支的接入路径和验收红线。Feature Flag `true` 分支规划必须遵守四大原则：
  - **默认 false**：生产配置默认关闭，走 legacy 稳定路径。
  - **development-only**：在代码和运行时进行 NODE_ENV 阻断，仅在开发和 QA 环境生效。
  - **用户最终决定优先**：Photo Battle 中用户的手动点击决断永远拥有最高优先级，覆盖算法预判。
  - **可快速回退**：发生任何异常时，可一键将开关改回 `false` 实现秒级无感回退，不影响照片状态和导出。

### 20. `CORE-DUPLICATE-6` (开发环境灰度接入 - 当前已完成)
- 在 Context 中正式读取了 Feature Flag，并加上了 canUseSignalGroupsForBattle 物理限流保护。
- **状态约束**：当前 false 分支必须继续保持稳定主流程。因为开关默认值为 `false`，所以最终用户的整理流程、A/B 擂台以及 ZIP 导出数据流 100% 保持原有遗留逻辑不变。用户最终分类依然只收敛为“保留”与“淘汰候选”两类。

### 21. `CORE-DUPLICATE-7-PLANNING` (true 分支本地测试规划 - 当前已完成)
- 新建了 `duplicate_true_branch_test_plan.md` 本地灰度测试方案。
- **状态与主流程约束**：下一阶段为 true 分支本地测试规划，不改变当前正式主流程。用户的最终分类在任何时候依然只收敛为“保留”与“淘汰候选”两类。

### 22. `CORE-DUPLICATE-7` (本地灰度开发调试 - 当前已完成)
- 经在本地开发环境临时开启开关，Demo 流程与双路算法校验 100% 对齐一致，流转测试完全通过。测试结束后开关已归位恢复为 `false`。
- **状态与主流程约束**：当前正式主流程依然保持为 legacy 方案，以确保安全稳定。下一步工作流建议是推进 20-50 张非隐私本地图片 true 分支测试与新信号类型适配开发（`CORE-DUPLICATE-8-PLANNING`）。最终的用户可见分类依然保持二值化收敛为“保留”与“淘汰候选”。

### 23. `CORE-DUPLICATE-8-PLANNING` (类型适配与本地测试规划 - 当前已完成)
- 新建了 `duplicate_signal_type_adapter_plan.md` 类型适配方案，并设计了 20-50 张非隐私本地图片的 true 分支手动灰度测试细节。
- **状态与主流程约束**：下一阶段的重点为：本地小批量 true 分支测试与 signal group 显式类型适配；依然严禁扩大 production 启用范围，当前主流程 100% 保持稳定 legacy 分流，用户分类依然为“保留”与“淘汰候选”。

### 24. `CORE-DUPLICATE-8` (类型适配实现 - 当前已完成)
- 新增并导出了显式纯适配器函数 `adaptSignalGroupsToLegacySimilarGroups`，消除强转使得类型适配在编译层面更加安全。
- **状态与主流程约束**：当前正式主流程依然保持为 legacy 稳定路径，不对用户主工作流进行任何侵入修改，最终的用户分类保持为“保留”与“淘汰候选”。

### 25. `CORE-DUPLICATE-9-PLANNING` (20-50 张非隐私本地图片测试规划 - 当前已完成)
- 本轮制定了 20-50 张非隐私本地图片 true 分支的灰度回归测试方案，并在项目根目录下新建了 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
- **状态与主流程约束**：本轮只做规划，不修改任何 src 代码，不运行本地图片测试。当前正式主流程仍保持稳定 legacy，USE_SIGNAL_GROUPS_FOR_BATTLE 保持默认为 false，用户的最终分类二值化收敛为“保留”与“淘汰候选”。

### 26. `CORE-DUPLICATE-9` (20-50 张本地图片 true 分支灰度回归测试 - 当前已完成)
- 成功执行了 35 张非隐私本地图片在开发环境下的临时 true 分支回归测试，测试通过且开关已归位恢复为 false。
- **状态与主流程约束**：当前主流程仍保持 legacy。下一步建议 `CORE-DUPLICATE-10-PLANNING`：规划 100-300 张中批量非隐私图片测试。用户最终分类仍只有保留 / 淘汰候选。

### 27. `CORE-DUPLICATE-10-PLANNING` (100-300 张中批量本地图片测试规划 - 当前已完成)
- 本轮制定了 100-300 张非隐私本地图片 true 分支的性能与稳定性测试方案，并在项目根目录下新建了 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
- **状态与主流程约束**：本轮只做规划，不修改任何运行代码，不运行图片测试。当前正式主流程仍保持稳定 legacy，USE_SIGNAL_GROUPS_FOR_BATTLE 保持默认为 false，用户的最终分类二值化收敛为“保留”与“淘汰候选”。

### 28. `CORE-DUPLICATE-10` (100-300 张中批量本地图片仿真测试 - 当前已完成)
- 成功执行了 200 张非隐私本地仿真图片在开发环境下的临时 true 分支元数据链路测试，两路算法比对指标一致性 100% 校验通过，状态机流转正常，开关已恢复为 `false`。
- **状态与主流程约束**：
  - 本轮测试为**仿真元数据测试**，并不等于真实大图读取、解码、Canvas 像素分析、UI 重绘及 ZIP 打包压缩等物理压力测试。
  - 开关复位：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为 `false`。
  - 主流程锁定：当前正式主流程仍保持稳定 legacy。
  - 分类约束：最终的用户分类依然二值化收敛为“保留”与“淘汰候选”。
  - 下一步方向：建议进入 `CORE-DUPLICATE-11-PLANNING`，规划真实 100-300 张物理图片文件的压力测试，解决主线程物理 I/O 和渲染负载验证。

### 29. `CORE-DUPLICATE-11-PLANNING` (真实 100-300 张图片文件压力测试规划 - 当前已完成)
- 已在项目根目录新建 [duplicate_real_file_stress_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_real_file_stress_test_plan.md) 规划真实 100-300 张物理图片文件的压力测试。
- **状态与主流程约束**：
  - 测试重点从算法逻辑对齐扩展到真实物理文件处理压力（I/O 读取、Canvas 解析、缩略图渲染及 ZIP 大队列打包）。
  - 主流程与分类锁定：正式主流程依然保持为 legacy 方案，最终用户可见的分类仍只有“保留”与“淘汰候选”两类。

### 30. `CORE-DUPLICATE-11` (真实 100-300 张物理 BMP 图片压力测试 - 当前已完成)
- 成功分三档执行了 100/200/300 张真实 BMP 图片文件 true 分支的压力测试，双路 parity 一致性对齐通过，ZIP 打包及操作符合预期，开关已复位为 `false`。
- **状态与主流程约束**：
  - 测试局限：本轮测试仅覆盖小尺寸 24-bit 无压缩 BMP 物理大图，未直接覆盖 JPG/PNG/WebP 解码压强或手机原图及 HEIC/RAW。
  - 开关复位：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为 `false`，生产环境绝对禁启用。
  - 主流程与分类锁定：正式主流程依然保持为 legacy 方案，最终用户可见的分类仍只有“保留”与“淘汰候选”两类。
  - **下一步方向**：建议进入 `CORE-DUPLICATE-12-PLANNING`，规划 500+ BMP 大批量分档压测，或进行混合压缩格式（JPG/PNG/WebP）物理图片测试的规划。

### 31. `CORE-DUPLICATE-12-PLANNING` (混合格式真实图片测试规划 - 当前已完成)
- 已在项目根目录新建 [duplicate_mixed_format_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_test_plan.md) 规划 JPG / PNG / WebP 混合格式真实图片的 true 分支测试方案。
- **状态与主流程约束**：
  - 测试重点聚焦于浏览器解码性能、Canvas 重绘、缩略图大列表渲染、Photo Battle 以及混合格式下的 ZIP 导出归档。
  - 正式主流程依然保持为 legacy 方案不变。
  - 开关在测试期间严格遵循“即测即恢复 false”的规范。
  - 最终用户可见的分类仍只有“保留”与“淘汰候选”两类。

### 32. `CORE-DUPLICATE-12-ABORT-DOCS` (混合格式真实图片测试中止 - 当前已完成)
- **状态记录**：CORE-DUPLICATE-12 测试当前处于**中止**状态，而非通过。100 张混合图片测试已跳转至 `/results`，但由于测试脚本提取 React QA 状态时发生超时被中止。200 与 300 张测试未执行。
- **状态与主流程约束**：
  - 正式主流程仍保持 legacy 稳定分支运行，开关已恢复为默认 `false`。
  - 用户最终整理决策分类依然强制收敛为“保留”与“淘汰候选”二值。
  - 下一步将进入 `CORE-DUPLICATE-12-RETRY-PLANNING`，重新规划对混合格式测试的 QA 校验提取机制。

### 33. `CORE-DUPLICATE-12-RETRY-PLANNING` (混合格式重试规划 - 当前已完成)
- **重试规划**：针对第一次测试依赖 React Fiber 树遍历造成的超时故障，重新设计了不依赖 React Fiber 内部属性的 QA 指标读取重试方案，并在项目根目录下新建了 [duplicate_mixed_format_retry_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_retry_plan.md)。
- **状态与主流程约束**：
  - 正式主流程仍强锁定为 legacy 分流，开关常量默认值必须保持为 `false`。
  - 用户最终分类依旧强制二值收敛为“保留”与“淘汰候选”，不产生任何新的业务分类或状态改变。

### 34. `CORE-DUPLICATE-12-RETRY` (混合格式 100 张 retry 测试 - 当前已完成)
- **重试实测**：在开发环境下临时启用 `true` 分支，完成了 100 张混合格式 retry 物理压测，使用不依赖 React Fiber 的 console summary 读取方案顺利跑通全部数据，校验指标完全对齐。测试结束后开关已无残留复位为 `false`。
- **状态与主流程约束**：
  - 正式主流程依然维持 legacy 稳定处理，开关常量保持 `false` 不变。
  - 用户最终的分类体系仍旧强制收敛在“保留”与“淘汰候选”。
  - **下一步方向**：建议进入 `CORE-DUPLICATE-13-PLANNING`，规划 200 / 300 张 JPG / PNG / WebP 混合格式的 true 分支压力测试。

### 35. `CORE-DUPLICATE-13-PLANNING` (混合格式 200 / 300 张测试规划 - 当前已完成)
- **测试规划**：已在项目根目录下新建了 [duplicate_mixed_format_200_300_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_200_300_plan.md) 规划中等批量 200 张与 300 张真实图片文件在 true 灰度分支下的物理压力测试。
- **状态与主流程约束**：
  - 正式主流程仍保持 legacy 稳定分支运行，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值必须保持为 `false`。
  - 用户最终的分类体系仍旧强制收敛在“保留”与“淘汰候选”二值。

### 36. `CORE-DUPLICATE-13` (混合格式 200 / 300 张测试 - 当前已完成)
- **测试实测**：在开发环境下临时启用 `true` 分支，成功完成了 200 张与 300 张混合格式真实图片的物理压力测试，新旧相似算法数据 Parity 100% 一致。但 300 张大网格在首次加载与滚动时触发了轻微的 DOM 掉帧，表明浏览器主线程已接近处理上限。
- **状态与主流程约束**：
  - 正式主流程仍保持 legacy 稳定分支运行，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然强制为 `false`。
  - 用户最终的分类体系仍旧强制收敛在“保留”与“淘汰候选”二值。
  - **下一步方向**：建议进入 `CORE-PERFORMANCE-1-PLANNING`，规划针对大网格虚拟化列表渲染、Web Worker 异步解耦、分批加载和打包的系统性能优化路线。

### 37. `CORE-PERFORMANCE-1-PLANNING` (性能优化规划 - 当前已完成)
- **性能优化规划**：已在项目根目录下新建了 [performance_optimization_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/performance_optimization_plan.md) 规划了浏览器原型后台分析 Web Worker、分批处理、虚拟列表、懒加载缩略图以及流式 ZIP 导出打包等深度重构性能优化路线。基于 300 张物理压测出现的轻微滚动掉帧，决定不再继续进行 500+ 大批量的盲目压测，全面转型至性能结构性优化。
- **状态与主流程约束**：
  - 正式主流程仍保持 legacy 稳定分支运行，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值强制为 `false`。
  - 用户最终的分类体系仍旧强制收敛在“保留”与“淘汰候选”二值。

### 38. `CORE-PERFORMANCE-2-PLANNING` (虚拟网格与懒加载缩略图规划 - 已完成)
- **局部重构规划**：已在项目根目录下新建了 [results_virtual_grid_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/results_virtual_grid_plan.md) 规划结果展示页面（Results Page）的自研轻量级虚拟化滚动网格与缩略图离屏懒加载机制。此优化可在不引入任何第三方复杂依赖的前提下，有效降低 results 卡片 DOM 树节点个数和内存驻留开销，改善滚动性能。
- **状态与主流程约束**：
  - 本阶段规划属于纯 UI 展示层的局部渲染优化，不改动核心决策与 Context 状态机，亦不触碰感知聚类分析算法。
  - 正式主流程仍强制由 legacy 方案驱动，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值保持 `false`。
  - 用户可见的最终决策归档依旧强制收敛为“保留”与“淘汰候选”二值分类。

### 39. `CORE-PERFORMANCE-3-PLANNING` (results 虚拟网格代码接入点规划 - 已完成)
- **接入点重构规划**：已在项目根目录下新建了 [results_virtual_grid_integration_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/results_virtual_grid_integration_plan.md)，对 `src/app/results/page.tsx` 页面结构、照片列表变量名、操作按钮及解耦关系进行深度分析，明确定义了 `VirtualPhotoGrid` 的通用泛型 props 与滚动撑开、resize 重算逻辑，并强调第一版不做 objectURL 离屏回收以防解码闪烁.
- **状态与主流程约束**：
  - 本阶段只做代码接入点规划，不修改任何 src 代码与 Context。
  - 正式主流程仍保持 legacy，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值继续保持 `false`。
  - 用户最终的分类体系仍旧强制收敛在“保留”与“淘汰候选”二值分类。

### 40. `CORE-PERFORMANCE-4` (最小虚拟网格实现与挂载 - 当前已完成)
- **局部重构实现与回归测试**：新建了独立无状态、泛型自适应的 [VirtualPhotoGrid.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/components/desktop/VirtualPhotoGrid.tsx) 组件，并在 results 页面将保留区与淘汰候选区列表接入。回归测试（Demo、100 张、300 张 JPG / PNG / WebP 混合格式图片文件压力测试）已全部通过。
- **状态与主流程约束**：
  - 本次改动纯属 UI 渲染层优化，完全不涉及 Context 决策层、聚类分析算法、Photo Battle 擂台与 ZIP 打包底座。
  - 正式主流程依旧由 legacy 方案驱动，灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 强制保持为 `false`。
  - 用户可见决策分类依旧只有“保留”与“淘汰候选”两类。

### 41. `CORE-PERFORMANCE-5-PLANNING` (稳定 QA parity 输出规划 - 当前已完成)
- **规划完成与只读审查**：已在项目根目录下新建了 [qa_parity_output_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/qa_parity_output_plan.md)，详细规划了隐式 window 全局测试输出方案，本规划已成功通过 Codex 只读性安全与规范审查。
- **状态与主流程约束**：
  - 本阶段仅进行文档编制，不改写任何业务源码，不实现 window 属性，亦不改变 Context。
  - 下一步将进入 `CORE-QA-PARITY-1` 阶段，对 window 全局输出进行最小实现。
  - 正式主流程保持由 legacy 方案驱动，灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值强制为 `false`。
  - 用户最终可见的整理决策分类强制二值化收敛为“保留”与“淘汰候选”。

### 42. `CORE-QA-PARITY-1` (稳定 QA parity 最小实现 - 当前已完成)
- **最小实现**：在 [PhotoWorkspaceContext.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/context/PhotoWorkspaceContext.tsx) 中新增了 development-only 的全局 window 属性 `__AI_PHOTO_CLEANER_QA__` 写入。
- **状态与主流程约束**：
  - 本次修改受 `process.env.NODE_ENV === 'development' && typeof window !== 'undefined'` 双重条件硬卫拦截，绝不污染生产环境或服务端渲染（SSR）。
  - 输出字段仅包含老/新相似组及相似照片数对比、Leader 错配数、生成的毫秒级时间戳及标记源等，绝对不泄露任何用户文件路径、Base64/Blob 数据以及完整 photo 实例。
  - 正式主流程仍保持由 legacy 方案驱动，灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值继续保持 `false`。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。

### 43. `CORE-QA-PARITY-2` (使用 window QA summary 进行回归与生产防护验证 - 当前已完成)
- **回归测试与指标读取**：通过 `window.__AI_PHOTO_CLEANER_QA__` 全局对象，成功地记录了 100 张 and 300 张混合格式图片在灰度测试分支（`USE_SIGNAL_GROUPS_FOR_BATTLE = true`）下的比对结果（组数量与相似照片数量一致，零错配，分类在此样本下收敛于“保留”与“淘汰候选”的二值体系，UI、擂台、ZIP 导出运行正常）。
- **生产不暴露与安全隔离**：在生产包（`npm run build`）构建完成后，启动 production server 对生产环境进行了无头浏览器读取验证，确认 `typeof window.__AI_PHOTO_CLEANER_QA__` 为 `undefined`，production 验证未暴露任何测试或数字摘要数据。
- **状态与主流程约束**：
  - 正式主流程仍保持由 legacy 方案驱动，灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值继续保持 `false`。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。

### 44. `CORE-DUPLICATE-SIGNAL-SWITCH-PLANNING` (Signal Groups 灰度切换就绪度评估 - 当前已完成)
- **就绪度评估与规划**：已在项目根目录下新建了 [duplicate_signal_switch_readiness_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_signal_switch_readiness_plan.md)，对是否可以开启 signal groups 开发环境灰度切换阶段进行了全面安全与稳定性评估。
- **状态与主流程约束**：
  - 确认当前不直接开启 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `true`，生产环境保持强制 legacy。
  - 确认不移除 legacy `detectDuplicates` 及 `similarGroups` 主流程，以提供坚实的安全备份和快速回退能力.
  - 明确后续测试需要采用更接近手机真实相册的 100-300 张真实测试样本进行开发灰度测试。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。

### 45. `CORE-DUPLICATE-REALISTIC-ALBUM-PLANNING` (真实相册感样本测试规划 - 当前已完成)
- **测试规划**：已在项目根目录下新建了 [duplicate_realistic_album_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_realistic_album_test_plan.md) 规划更贴近手机真实相册的 100-300 张非隐私样本测试方案。
- **状态与主流程约束**：
  - 测试重点转移至在项目外目录构建真实非隐私相册集（不污染 Git），坚守隐私红线，HEIC/RAW 格式暂不纳入。
  - 正式主流程仍保持由 legacy 方案驱动，灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值继续保持 `false`。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。

### 46. `CORE-DUPLICATE-REALISTIC-ALBUM` (真实相册感样本测试 - 当前已完成)
- **测试结果**：成功在开发环境下临时启用 `true` 分支，完成了 100 / 300 张 mock 真实相册感非隐私样本在更真实相册结构下的 parity 测试，双路算法比对指标 100% 对齐。
- **状态与主流程约束**：
  - 功能保障：测试验证了 Photo Battle、ZIP 导出、results 网格虚拟滚动以及二值分类流程在此样本下均运转正常。
  - 开关复位：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已恢复并继续保持为 `false`。
  - 仍保持 production legacy 驱动主流程，不进入 production true。
  - 用户可见的最终决策归档依旧强制收敛为“保留”与“淘汰候选”二值分类。

### 47. `CORE-DUPLICATE-SIGNAL-BETA-PLANNING` (常态灰度评估规划 - 当前已完成)
- **就绪评估**：新建了 [duplicate_signal_beta_readiness_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_signal_beta_readiness_plan.md) 评估是否可以进入 development-only 常态灰度。
- **状态与主流程约束**：
  - 最终用户可见的分类依然收敛为“保留”与“淘汰候选”的二值分类，无中间态或其它分类。
  - 生产环境将继续锁定于 legacy 稳定驱动方案（`USE_SIGNAL_GROUPS_FOR_BATTLE` 常量默认值保持为 `false`），不进入 production true。

### 48. `CORE-DUPLICATE-LARGE-JPG-PLANNING` (大尺寸 JPG 灰度测试规划 - 已完成)
- **规划完成**：已新建 [duplicate_large_jpg_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_large_jpg_test_plan.md) 规划 100 / 200 张 3MB-10MB 大尺寸 JPG 非隐私测试，用于专门验证浏览器 I/O、Canvas 像素解码、主线程内存及大批量 ZIP 打包导出的压强。该规划已成功通过 Codex 只读审查。
- **状态与主流程约束**：
  - 正式主流程仍保持由 legacy 方案驱动，开关常量默认值强制为 `false`，不直接在生产环境启用 `true` 分支，production legacy 锁定状态不变。
  - 用户可见的整理决策分类依旧二值化强制收敛为“保留”与“淘汰候选”。

### 49. `CORE-DUPLICATE-LARGE-JPG-DOCS-COMMIT-PUSH` (提交大尺寸 JPG 测试规划文档 - 当前正在进行)
- **提交与推送**：补充执行记录模板、200张测试限制与测试边界，并提交推送规划文档。
- **状态与主流程约束**：
  - 开关常量默认值确认仍强制为 `false`，production 锁定 legacy 稳定路径不变。
  - 用户最终分类依旧强制收敛为“保留”与“淘汰候选”。
- **下一步**：将正式执行 `CORE-DUPLICATE-LARGE-JPG` 100 / 200 张大尺寸 JPG 本地开发环境测试。

### 49. `CORE-DUPLICATE-LARGE-JPG-DOCS-COMMIT-PUSH` (提交大尺寸 JPG 测试规划文档 - 已完成)
- **提交与推送**：补充执行记录模板、200张测试限制与测试边界，并提交推送规划文档。
- **状态与主流程约束**：
  - 开关常量默认值确认仍强制为 `false`，production 锁定 legacy 稳定路径不变。
  - 用户最终分类依旧强制收敛为“保留”与“淘汰候选”。

### 50. `CORE-DUPLICATE-LARGE-JPG` (大尺寸 JPG 灰度物理压测 - 已完成)
- **测试实测**：在开发环境下临时启用 `true` 分支，完成了 100 张和 200 张的物理压测。算法 parity 与 Photo Battle 完全对齐，但在 200 张大尺寸测试中暴露了超 1GB 大文件 ZIP 导出中断（`DownloadInterrupted`）的缺陷。
- **状态与主流程约束**：
  - 正式主流程仍保持由 legacy 方案驱动，开关常量默认值强制为 `false`，不直接在生产环境启用 `true` 分支，production legacy 锁定状态不变。
  - 用户最终分类依旧强制收敛为“保留”与“淘汰候选”。

### 51. `CORE-ZIP-LARGE-FILE-FIX-PLANNING` (大文件 ZIP 下载中断修复规划 - 已完成)
- **修复规划与审查**：已在项目根目录下新建了 [zip_large_file_fix_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/zip_large_file_fix_plan.md) 规划大文件 ZIP 下载中断的修复方案。该规划已正式通过 Codex 只读性安全与规范审查（CORE-ZIP-LARGE-FILE-FIX-QA）。该下载中断缺陷属于底层 ObjectURL 生命周期提早释放问题，独立于新相似组的算法 parity 逻辑。
- **状态与主流程约束**：
  - 维持 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然强制为 `false`，生产环境锁定 legacy 稳定路径不变。
  - 最终用户可见的分类依然收敛为“保留”与“淘汰候选”的二值分类。
- **下一步**：已进入 `CORE-ZIP-LARGE-FILE-FIX` 阶段，仅对 ObjectURL 的生命周期与清理时机进行了最小化延迟释放修复。

### 52. `CORE-ZIP-LARGE-FILE-FIX` (大文件 ZIP 下载中断修复实现 - 已完成)
- **修复实现与回归结果**：已对 `src/app/results/page.tsx` 中 `downloadPhotosZip` 进行了最小代码修复，通过 `setTimeout` 延迟 120 秒释放 ObjectURL。该修复已安全通过代码审查与编译验证。实测结果显示，100 张相册大包（643.25MB）和 200 张保留区小包（15.78MB）成功完整下载，证明延迟 Object URL 生命周期能解决中等大包异步磁盘写入的冲突；但在 200 张淘汰区大包（1.27GB）压力下依然出现 `DownloadInterrupted` 中断。这说明大尺寸 JPG 全链路在单包 1GB+ 的极端体量下仍未完全通过，此最小延时方案并非超大型单包 ZIP 的最终解法。
- **修复范围与限制**：
  - 修复范围严格限制在 ObjectURL 的生命周期管理，没有改动 ZIP 内文件内容选择与筛选分区逻辑。
  - 双路算法 parity 对齐、照片 processing 处理、A/B 擂台及 Photo Battle 状态机均完全不受此修复影响。
  - 生产环境强制 legacy 配置，灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 在代码中继续强力保持为 `false` 不变。
- **下一步**：已在 `CORE-ZIP-BATCH-EXPORT-REGRESSION` 阶段完成分批 ZIP 导出的实现与回归测试。

### 53. `CORE-ZIP-BATCH-EXPORT` (分批 ZIP 导出实现与回归 - 当前已完成)
- **实现与回归内容**：已在 `src/app/results/page.tsx` 中完成了分批 ZIP 导出的实现，并在 `CORE-ZIP-BATCH-EXPORT-REGRESSION` 阶段通过了本地 Node.js 大尺寸 JPG 物理打包回归测试。
- **回归测试结论**：
  - **小包兼容（零回退）**：当前样本下小相册不回退，小图及 Demo 依然直接下载单包 `keep_photos.zip` 与 `cull_photos.zip`，未错误生成 `_part_1` 编号。
  - **大包分包成功**：100 张大尺寸 JPG 成功导出（保留区 1 包 275MB，淘汰区 2 包最大 247MB）；200 张大尺寸 JPG 成功导出（保留区 2 包最大 501MB，淘汰区 3 包最大 247MB）。合计数量与 results 分区完全对齐，后缀保留 `.jpg`。
  - **规避中断**：测试过程中未生成单个 1GB+ 的超大 Blob，当前样本下规避了内存溢出，当前回归中未再出现 `DownloadInterrupted` 错误，下载连续排队且未被浏览器拦截。
- **兼容性与逻辑隔离**：
  - **核心逻辑隔离**：分批 ZIP 导出是纯展示层的 I/O 规避手段，其修复工作完全独立于相似检测 `duplicate.ts` 及 signal groups 算法的 parity 对齐逻辑。未修改 `PhotoWorkspaceContext.tsx`、对局状态机、客观分析与 `getUserVisibleBucket` 分区算法，用户决定的二值分类逻辑保持原状。
  - **生产隔离防护**：灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然在物理上强力保持为 `false`。生产环境（production）继续强制锁定于 legacy 稳定路径运行，不移除 legacy 链路，不进入 production true。
- **下一步方向**：已进入 `CORE-STABILIZE-SNAPSHOT-PLANNING` 阶段，整理当前核心稳定化成果快照并规划下一步。

### 54. `CORE-STABILIZE-SNAPSHOT-PLANNING` (核心稳定化阶段快照整理 - 当前已完成)
- **内容记录**：已正式启动并完成了对当前核心稳定化阶段所有成果的系统性快照整理，新建了项目根目录快照文档 [core_stabilize_snapshot.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/core_stabilize_snapshot.md)。
- **成果汇总**：
  - 确认大文件 ZIP 导出阶段已完整完成实现、回归测试以及 Post-QA 代码和文档审查。
  - 确认虚拟滚动网格 `VirtualPhotoGrid` 运行状况良好，QA window 隐式元数据摘要在 production 中得到绝对物理阻断隔离。
- **下一步建议**：根据当前的成果与风险态势，下一步推荐方向为 `CORE-DUPLICATE-REPEATABILITY-PLANNING`（测试集 3-5 次多轮重复运行性与内存泄漏验证），以确保系统的长期可靠性，而非盲目在开发环境增加一次性压强。
- **安全约束**：重申灰度开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值必须保持为 `false`，生产环境绝对走 legacy 稳定驱动方案，用户决定的二值分类逻辑保持完全不变。
- **下一步方向**：已进入 `CORE-DUPLICATE-REPEATABILITY-PLANNING` 阶段，规划同一测试集重复运行的稳定性测试。

### 55. `CORE-DUPLICATE-REPEATABILITY-PLANNING` (重复运行稳定性测试规划 - 已完成)
- **内容记录**：已正式启动并完成了对同一测试集多次循环、重复运行稳定性的测试方案编制，新建了项目根目录规划文档 [duplicate_repeatability_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_repeatability_test_plan.md)。
- **规划定位**：
  - 核心目标是验证同一测试集在开发灰度分支下连续循环重复运行 3-5 次的性能，尤其是对内存回收、Canvas 与 Object URL 句柄销毁的资源观察，防止出现多轮重入变慢或卡死，而非盲目扩大单次测试张数压力。
  - 规定了在重复运行通过之前，系统绝不进入 beta 阶段，生产环境（production）继续强制锁定于 legacy 稳定路径运行，不进入 production true，不移除 legacy 稳定底座。
- **下一步方向**：该规划已顺利通过 Codex QA 审查，未执行实际测试。下一步建议进入 `CORE-DUPLICATE-REPEATABILITY` 阶段，执行 100 张和 200 张大尺寸 JPG 连续 3 轮重复性稳定性测试。

### 56. `CORE-DUPLICATE-REPEATABILITY` (重复运行稳定性测试 - 已完成)
- **测试执行**：在开发环境下临时启用 `true` 分支，完成了大尺寸 JPG 连续重复性测试。
- **100 张大尺寸 JPG**：顺利通过 3 轮完整测试。Parity 校验完全对齐，`leaderMismatchCount = 0`，没有出现 DownloadInterrupted，回收后内存稳定（无台阶式上涨）。
- **200 张大尺寸 JPG**：Round 1 失败。处理时间 58.01s，Parity 对齐，但 `cull_photos_part_3.zip` 导出打包下载过程中出现 `DownloadInterrupted` 导致测试中止。JSZip 压缩打包时 Peak 物理内存达 `4454.17MB`。
- **回退保护**：开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已于测试中止后自动恢复为 `false`。
- **结论**：本轮失败并非算法、状态机或分区逻辑错误，而是由于 500MB / 50张 / 1500ms 分批 ZIP 参数、Blob 内存叠加、主线程内存峰值及下载管道压力导致。需进入分批 ZIP 参数调优。

### 57. `CORE-ZIP-BATCH-PARAM-TUNING-PLANNING` (分批 ZIP 参数调优规划 - 当前进行中)
- **内容记录**：已正式启动参数调优规划，新建了项目根目录规划文档 [zip_batch_param_tuning_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/zip_batch_param_tuning_plan.md)。
- **调优决策**：功能与分批架构保留，绝不回退。计划将局部阈值常量收紧为：
  - `MAX_ZIP_BATCH_BYTES = 300 * 1024 * 1024` (300MB)
  - `MAX_ZIP_BATCH_PHOTOS = 30`
  - `ZIP_BATCH_DOWNLOAD_DELAY_MS = 3000` (3.0秒)
- **安全红线**：不改写 src 业务核心代码，不引入 Web Worker、流式打包或 Tauri，特性开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 继续保持为默认 `false`，生产环境强制 legacy，且 200 张重复性通过前不进入 beta 与默认启用灰度分支。
