# AI Photo Cleaner 混合格式测试重试规划 - CORE-DUPLICATE-12-RETRY-PLANNING

## 一、 失败原因总结

`CORE-DUPLICATE-12` 第一次测试未完成。原因并不是产品主流程（例如图片解码、Canvas 分析或 results 页面）失败，而是测试脚本在无界面（headless / offscreen）`QWebEnginePage` 运行环境下，通过遍历 React Fiber 内部私有结构读取 `duplicateGroupQA` 数据时收到 `None`，导致脚本轮询指标最终超时。

当前已确认的事实：
- 开发环境 dev server 能够正常响应并就绪。
- `/processing` 照片扫描分析正常流动并能完成。
- `/processing` actual 扫描分析耗时约 8.12 秒。
- `/results` 结果页能成功进入并跳转。
- 控制台确实已成功打印：`[JS-TEST] Found duplicateGroupQA!`（表明双路比对已在 React Context 初始化后被成功计算并缓存）。
- 开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已安全恢复为默认极值 `false`。
- 项目 `src` 源码完全没有脏变动。
- 本轮未能完整执行完毕，因此**不能声明混合格式测试通过**。

---

## 二、 规划新的 QA 指标读取方式

为了防止在 headless 测试环境中因为 React Fiber 版本水合和私有节点属性变更带来的读取不稳定性，**后续重试禁止继续依赖 React Fiber 遍历读取状态**。

我们建议使用以下三种更稳定的替代方案，优先级依次从高到低：

### 方案 A：读取 development console summary (推荐优先采用)
- **读取逻辑**：由于 `PhotoWorkspaceContext.tsx` 在开发环境（development）中会在分析完成时通过 `console.debug` 或 `console.log` 单次且结构化地打印 QA 比对摘要。测试脚本应该直接通过 `QWebEnginePage.javaScriptConsoleMessage` 捕获该日志的控制台明文输出。
- **安全规范**：控制台输出必须只包含数字指标（如 old/new group count），绝对不包含图片的本地物理路径、Base64 以及完整照片实体对象。
- **输出格式示例**：
  `[Duplicate SimilarGroups QA] {"oldSimilarGroupCount": 15, "newSimilarGroupCount": 15, "similarGroupCountMismatch": false, "oldSimilarGroupedPhotoCount": 60, "newSimilarGroupedPhotoCount": 60, "similarGroupedPhotoCountMismatch": false, "leaderMismatchCount": 0}`

### 方案 B：读取页面可见 UI 结果 (备选)
- **读取逻辑**：直接通过页面 DOM 节点爬取用户可见的分区计数与提示文字（例如从 PK 队列提示区域提取 "当前待处理：X 组" 的文本）。
- **安全规范**：只抓取 UI 外显指标，不读取任何 React 内部私有变量。这能反映用户最真实的交互状态。

### 方案 C：未来新增 dev-only QA summary 输出 (仅作为重构兜底规划)
- **读取逻辑**：如果后续测试确实需要更高精度的数据流，且方案 A 与 B 都无法满足，可规划在 Context 初始化后，将简易的对比摘要对象（仅限 metrics）直接挂载至 `window.__qa_summary__` 上供脚本直接读取。
- **安全规范**：该输出必须受到 `process.env.NODE_ENV === 'development'` 的强阻断保护，在生产环境（production）下绝对不可挂载，严禁影响正式业务流程。
- **特别强调**：*本轮仅作设计规划，绝对不修改 src 业务代码来实现此方案。*

---

## 三、 规划重试策略

为了降低执行风险并减少冗余时间开销，`CORE-DUPLICATE-12-RETRY` 阶段必须分两步逐步推进：

### Step 1：只重试 100 张混合格式图片
- **目标**：专注于验证新设计的 QA 指标读取方式（方案 A / 方案 B）在无界面浏览器中是否能稳定、高鲁棒地跑通。
- **中止原则**：如果 100 张图片重试仍然报错超时或卡住，**禁止继续执行 200 张与 300 张测试**，立刻停止并恢复 `false` 极值。

### Step 2：100 张测试通过后，再执行 200 张与 300 张测试
- 保持原有三档测试逐步递增的设计原则。
- 逐档记录详细指标（包括分析时间、内存以及 ZIP 导出校验）。
- 每次测试结束必须立即物理恢复为 `false`。

---

## 四、 规划重试验收标准

只有满足以下 13 项标准时，重试才被判定为通过：

1. **零 React Fiber 依赖**：测试脚本不以任何形式尝试遍历或读取 React 内部 Fiber props。
2. **指标完整性**：测试脚本能 100% 稳定读取出 old/new group count 与 leaderMismatchCount。
3. **100 张测试完整运行**：从上传到分析、对决模拟及 ZIP 导出均能一气呵成。
4. **`/processing` 正常**：进度诊断及大批量文件解码流畅。
5. **`/results` 正常**：首次渲染无假死，JPG / PNG / WebP 缩略图均能正常预览。
6. **Photo Battle 自动激活**：擂台对决能自动根据相似组触发弹出。
7. **ZIP 导出一致**：下载得到的保留区和淘汰候选区 ZIP 分区与页面 results 完美一致。
8. **ZIP 保留原格式**：导出的图片格式与后缀不被强制更改。
9. **无页面死锁**：全程不触发浏览器“页面无响应”弹窗。
10. **即测即恢复**：测试完毕后，`USE_SIGNAL_GROUPS_FOR_BATTLE` 常量必须无条件恢复为默认 `false`。
11. **Git 无残留**：`git diff -- src/lib/config/featureFlags.ts` 完全为空，没有 true 残留。
12. **零脏代码变动**：无任何未预期的 src 代码物理修改。
13. **编译无报错**：`npm run build` 和 `npm run lint` 回归成功。

---

## 五、 规划失败处理

如果在后续重试中仍然失败（如 console 仍未能捕获或有其它未预期报错）：

1. **开关立刻切回**：立即将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 恢复为 `false`，生产主流程保持 legacy 不受侵入。
2. **禁止带脏提交**：绝不 commit 临时改为 `true` 的常量，更不 push 到远程仓库。
3. **拒绝原地修改业务代码**：不要在没有论证的情况下强行改动 Context 去适配自动化脚本。
4. **提报只读分析**：记录失败对应的详细阶段，进入 `CORE-DUPLICATE-12-FAIL-2-READ`，提报给 Codex 进行只读性审查，并在此阶段才正式研究并设计“方案 C”的挂载实现，通过审查后再行测试。

---

## CORE-DUPLICATE-12-RETRY 100 张混合格式实测结果

### 测试范围
- 本轮只执行 100 张 JPG / PNG / WebP 混合格式测试。
- 按计划跳过 200 / 300 张。
- 测试图片位于项目外部目录：
  `D:\ai-photo-cleaner-mixed-format-test`
- 测试图片未进入 Git。
- JPG：60 张。
- PNG：20 张。
- WebP：20 张。
- 总文件大小约 15.6 MB。
- 本阶段不包含 HEIC / RAW / GIF / 视频 / 10MB+ 超大手机原图。

### Feature Flag 状态
- 测试前 `USE_SIGNAL_GROUPS_FOR_BATTLE` = `false`。
- 测试中临时改为 `true`。
- 测试结束后已恢复 `false`。
- `git diff -- src/lib/config/featureFlags.ts` 无 `true` 残留。
- production guard 未修改。

### 测试读取方式
- 本轮使用 console summary 读取 QA 指标。
- 未再使用 React Fiber。
- 未遍历 React 内部私有结构。
- 控制台成功出现：
  `[JS-TEST] Found duplicateGroupQA via console summary!`
- QA Metrics loaded successfully。

### 测试结果
- `/desktop` 正常。
- `/processing` 正常.
- `/processing` 耗时 8.44 秒。
- `/results` 正常。
- results 首次渲染正常。
- JPG 正常预览。
- PNG 正常预览。
- WebP 正常预览。
- Photo Battle 自动触发。
- PK 组数：15。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常，未产生第三最终分类。
- reset 正常。
- 保留区 ZIP 正常，下载 `keep_photos.zip`。
- 淘汰候选区 ZIP 正常，下载 `cull_photos.zip`。
- ZIP 和页面分区一致。
- ZIP 保留 JPG / PNG / WebP 原始格式和后缀。
- 无卡顿。
- 无浏览器无响应。
- 无控制台报错。
- 无第三最终分类。

### QA 指标
- success: true
- oldSimilarGroupCount: 15
- newSimilarGroupCount: 15
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 60
- newSimilarGroupedPhotoCount: 60
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0

### 结论
- 100 张 JPG / PNG / WebP 混合格式 retry 测试通过。
- console summary 方案成功替代 React Fiber。
- 当前仍必须保持 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`。
- 不允许默认启用 `true`。
- 不允许 production 启用 `true`。
- 200 / 300 张混合格式尚未测试。
- HEIC / RAW 尚未测试。
- 下一步建议规划 200 / 300 张混合格式测试。
