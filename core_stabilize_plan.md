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
