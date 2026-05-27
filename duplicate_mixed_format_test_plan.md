# AI Photo Cleaner 混合格式真实图片测试规划 - CORE-DUPLICATE-12-PLANNING

## 一、 测试目标

`CORE-DUPLICATE-12` 的目标是规划并验证 JPG / PNG / WebP 混合格式真实图片在本地开发环境（development）中临时手动启用 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 灰度通道时的系统性能与稳定性。

### 本测试与 CORE-DUPLICATE-11 的核心区别

- **CORE-DUPLICATE-11 (BMP 文件压力测试)**：
  - 测试对象为小尺寸 24-bit 无压缩 BMP 物理图片文件。
  - 重点验证了真实文件读取、Canvas 解析、结果页缩略图和 ZIP 打包的底层基础数据链路是否能跑通。
  - 不包含且无法代表常见压缩图片格式（如 JPG、PNG、WebP 等）的解压解码压力。
- **CORE-DUPLICATE-12 (混合格式真实图片测试)**：
  - 测试对象为真实的 JPG、PNG、WebP 混合压缩格式图片文件。
  - 更接近真实用户的日常相册组成。
  - 重点验证在不同算法解码开销、不同的元数据及通道压缩率下，浏览器解压缩解码、Canvas 像素重绘、网格渲染、连通图 BFS 相似分组、Photo Battle 以及多格式 ZIP 打包导出的稳定性。

---

## 二、 测试图片选择标准

为了确保数据合规及开发隔离，测试照片集必须符合以下硬性合规防线：

1. **数量规模**：选取 100-300 张物理图片。
2. **敏感安全红线**：必须是完全无隐私、非敏感的照片（如风景、静物、街拍等）。
3. **禁止私人照**：绝对禁止使用任何家庭私人照片、私人肖像或涉及个人隐私的图像。
4. **禁止证件敏感图**：绝对禁止使用包含身份证、车牌号、护照、银行卡、各种账单等敏感信息的照片。
5. **禁止客户照片**：绝对禁止使用真实用户的隐私客户图片测试。
6. **不复制进项目目录**：绝对禁止将测试照片复制到项目源码的物理目录内。
7. **禁止提交到 Git**：绝对禁止将测试图片 commit 或 push 到 Git 仓库历史中。
8. **载入形式**：仅在开发服务器运行时通过浏览器 File Input 临时选择并载入内存。
9. **外部独立存放**：建议将测试照片单独存放在项目目录外的独立文件夹中，例如：
   - `D:\ai-photo-cleaner-mixed-format-test`
10. **清理机制**：测试任务完成后可立即物理删除该外部照片集，不留隐患。

### 建议格式组成：
- **JPG**：60% 左右（包含不同压缩率的 JPG）。
- **PNG**：20% 左右。
- **WebP**：20% 左右（WebP 数量不必过多，但必须覆盖）。

### 建议图片内容组成：
- **相似组**：10-20 组真实的连拍 / 相似照片（每组 2-5 张，包括同一场景不同格式的图片）。
- **普通干扰组**：50 张以上完全独立的非相似干扰照片。
- **模糊图片**：少量对焦不准或抖动模糊的图片。
- **曝光异常图片**：少量严重过曝或欠曝的照片。
- **多种尺寸**：包含多种不同分辨率大小的照片。

### 暂不测试：
- HEIC / HEIF
- 各种相机 RAW 原始格式
- 超大 10MB+ 手机原图
- 视频文件
- GIF 动图

---

## 三、 分阶段测试方式

规划分为以下三档逐步推进：

### 第一档：100 张混合格式图片
- **目标**：验证 JPG / PNG / WebP 混合导入基础链路。
- **重点**：观察 `/processing` 的压缩格式解码和 Canvas 像素诊断是否卡顿，`/results` 网格缩略图首次渲染是否正常显示各格式，Photo Battle 对战擂台是否能自动触发，以及 ZIP 是否能正确打包。

### 第二档：200 张混合格式图片
- **目标**：对齐 `CORE-DUPLICATE-11` 的 200 张真实文件量级，横向对比 BMP 与压缩格式在解码计算上的耗时增加。
- **重点**：观察内存占用增量、缩略图网格滚动是否有延迟，以及大队列 ZIP 打包压缩压力。

### 第三档：300 张混合格式图片
- **目标**：验证浏览器原型在中批量混合压缩格式下的上限表现。
- **硬性约束**：如果第二档（200张）测试已出现明显的浏览器卡顿，则中止测试，**禁止继续执行 300 张压测**。

---

## 四、 测试前检查

在手动将 feature flag 修改为 true 之前，确认以下 12 项检查条件：

1. **Git 工作区**：执行 `git status --short` 确认当前工作区干净（无未 commit 的 src 改动）。
2. **GitHub 推送**：当前 main 分支最新文档 commit 已成功 push 到远程仓库。
3. **开关初始状态**：`src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
4. **生产隔离守卫**：Context 内部 production 运行时环境防护逻辑未做任何改动。
5. **构建正常**：`npm run build` 顺利通过。
6. **Lint 正常**：`npm run lint` 顺利通过。
7. **图片存放隔离**：测试照片确实存放在项目源码目录外部，不在项目路径内。
8. **敏感内容核对**：核对测试照片不包含任何个人隐私、肖像或证件账单等敏感内容。
9. **开发调试准备**：浏览器开发者工具 DevTools 已打开并切换至 Console 窗格。
10. **内存观察工具**：开启 Chrome Task Manager（浏览器任务管理器）以记录内存开销。
11. **系统环境纯净**：关闭其他大型 CPU/内存占用应用，防止造成卡顿误判。
12. **Git 忽略**：检查确认测试图片文件夹绝不会被 Git 追踪。

---

## 五、 临时 true 测试步骤

未来执行 CORE-DUPLICATE-12 测试时，必须严格执行以下动作步骤：

1. **确认 Git 状态**：
   ```bash
   git status --short
   ```
2. **确认开关初始值**：
   确认 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `false`。
3. **临时手动启用**：
   修改 `src/lib/config/featureFlags.ts` 将开关临时改为：
   ```typescript
   export const USE_SIGNAL_GROUPS_FOR_BATTLE = true;
   ```
4. **启动开发服务器**：
   ```bash
   npm run dev
   ```
5. **打开工作台**：
   在浏览器中打开 `http://localhost:3000/desktop`。
6. **导入第一档（100张）混合格式非隐私图片**。
7. **观察并记录 `/processing` 阶段表现**：
   - 记录是否明显卡顿及分析完成大概耗时。
   - 检查是否有浏览器无响应及控制台错误。
   - 观察浏览器内存是否明显上升，观察是否有特定格式（如 WebP）导致解码报错。
8. **观察并记录 `/results` 结果页加载**：
   - 确认网格卡片和缩略图是否正常显示，是否有特定格式图片无法预览或空白。
   - 检查 Photo Battle 擂台对决是否自动被激活弹出，需要 PK 的组数是否合理。
9. **执行 Photo Battle 抽样测试**：
   进行对决操作，验证以下状态机交互：
   - 保留左图（`keep_left`）/ 保留右图（`keep_right`）。
   - 两张都保留（`keep_both`）。
   - 两张都标记为淘汰候选（`cull_both`）。
   - 跳过对局（`skip`），检查未决照片是否正常留在待决队列，未产生第三最终分类。
   - 重置对战（`reset`），检查对战状态是否能无损复原。
10. **执行 ZIP 导出一致性测试**：
    - 导出保留区 ZIP 和淘汰候选区 ZIP 并下载。
    - 记录 ZIP 打包压缩是否耗时过长，确认导出的 ZIP 文件内容和 results 页面分区 100% 对齐一致。
    - 确认 ZIP 解压后各个文件的原始格式（JPG/PNG/WebP）正确保留，没有被非预期改写后缀或格式损坏。
11. **记录本档 QA 指标**。
12. **推进第二档（200张）测试**：
    若 100 张测试正常，清理工作区后，导入 200 张混合图片重复上述步骤 7-11。
13. **推进第三档（300张）测试**：
    若 200 张测试正常且无明显卡顿，导入 300 张混合图片重复上述步骤 7-11。
14. **物理恢复 false 极值**：
    测试完毕后，立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 常量改回 `false`。
15. **校验 Git 无残留**：
    ```bash
    git diff -- src/lib/config/featureFlags.ts
    ```
    确认配置无任何 true 差异残留，回到 clean 状态。
16. **回归包物理校验**：
    ```bash
    npm run build
    npm run lint
    ```

---

## 六、 必须记录的 QA 指标

CORE-DUPLICATE-12 测试执行人必须详细记录以下指标：

### 1. 基础指标
- **图片数量**（张）：
- **JPG 数量**（张）：
- **PNG 数量**（张）：
- **WebP 数量**（张）：
- **测试总文件大小**（MB, 估算）：
- **平均单图大小**（KB/MB, 估算）：
- **`/processing` 真实分析耗时**（秒）：
- **`/results` 首次网格渲染是否正常**：
- **测试过程中是否出现浏览器级无响应**：
- **控制台是否出现任何报错**：
- **是否有格式无法预览或空白**：
- **浏览器进程内存上升峰值**（MB）：

### 2. 相似检测指标
- **oldSimilarGroupCount**（旧算法组数）：
- **newSimilarGroupCount**（新客观信号组数）：
- **similarGroupCountMismatch**（组数是否不匹配）：
- **oldSimilarGroupedPhotoCount**（旧算法照片数）：
- **newSimilarGroupedPhotoCount**（新客观信号照片数）：
- **similarGroupedPhotoCountMismatch**（照片数是否不匹配）：
- **leaderMismatchCount**（组长推荐差异数）：

### 3. Photo Battle 交互指标
- **Photo Battle 擂台是否可以自动触发弹出**：
- **PK 组数总计**（组）：
- **是否完成全部对局的 PK**（是/否）：
- **若未完成全部对局，具体原因**：
- **`skip` 与 `reset` 是否正常**：
- **是否产生除“保留”/“淘汰候选”以外的第三最终分类**：

### 4. 导出与回归指标
- **保留区 ZIP 是否成功下载且无卡顿**：
- **淘汰候选区 ZIP 是否成功下载且无卡顿**：
- **ZIP 归档划分是否与页面 results 物理分区 100% 一致**：
- **ZIP 内文件是否正确保留了原始格式（非破坏后缀）**：
- **ZIP 打包下载大致耗时**（秒）：
- **测试结束后配置是否已恢复为 false**：
- **`git diff` 校验是否完全无 true 残留**：
- **`npm run build` 和 `npm run lint` 是否通过**：
- **是否有测试图片进入 Git**：

---

## 七、 验收通过标准

只有当满足以下 20 项标准时，才被判定为混合格式真实图片测试通过：

1. `/desktop` → `/processing` → `/results` 全程无任何假死与页面白屏。
2. `/processing` 阶段对 JPG / PNG / WebP 三种格式均能稳定解码并读取像素。
3. `/results` 首次网格渲染流畅，JPG / PNG / WebP 缩略图均可正常预览显示。
4. 照片卡片滚动流畅，无明显掉帧。
5. 页面没有触发浏览器级“页面无响应”的等待弹窗。
6. Photo Battle 擂台可根据实际分组数自动触发并激活。
7. 至少进行一轮完整的 Photo Battle 交互且状态更新无卡滞。
8. `skip` 操作将未决照片保留在待决队列，未引入第三分类。
9. `reset` 重置擂台后状态无损复原。
10. “保留”与“淘汰候选”工作区分区重绘流畅。
11. ZIP 导出压缩与 results 页面二值展示物理一致。
12. ZIP 导出的压缩包中，各个图片文件格式（JPG/PNG/WebP）没有被破坏或强制更改。
13. 运行比对日志仅在 development 环境下输出。
14. 控制台日志不含图片的本地物理路径、Base64 以及完整照片实体数据。
15. `oldSimilarGroupCount === newSimilarGroupCount`（如有少量因精度造成的差异，需有明确技术解释）。
16. `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`。
17. `leaderMismatchCount === 0`（如有偏离需确认不影响用户的保留二值包）。
18. 测试完毕后开关彻底恢复为默认 `false` 值。
19. `git diff` 检查 featureFlags.ts 没有任何 true 差异。
20. `npm run build` 和 `npm run lint` 成功。

---

## 八、 中止与停止条件

在测试过程中，如果出现以下任何一种异常，**必须立即中止继续扩大测试**：

1. **第一档（100张）** 混合测试已出现明显严重的卡顿或界面无法操作。
2. **第二档（200张）** 测试中浏览器产生“页面无响应”弹窗。
3. **特定格式解码失败**：某种压缩格式文件大量无法在浏览器中解码、解析像素或预览白屏。
4. **结果页渲染假死**： results 网格卡片重绘时主线程卡住。
5. **Photo Battle 无法激活**：对局状态机阻塞。
6. **ZIP 导出打包失败**：JSZip 无法将特定格式的 Blob 数据打包。
7. **控制台异常**：控制台连续抛出未捕获错误。
8. **QA 日志刷屏**：控制台输出过多比对细节。
9. **Git 泄露风险**：测试图片意外被复制到项目内并被 Git 追踪。
10. **开关异常**：`USE_SIGNAL_GROUPS_FOR_BATTLE` 变量由于编辑器冲突无法归位恢复为 `false`。

---

## 九、 性能瓶颈与后续优化方向

如果混合格式真实图片测试性能不理想，不应当继续强行扩大测试规模，而应当启动以下优化方案的设计：

1. **Web Worker 异步解耦**：将 Canvas 像素读取、感知哈希比对以及连通分量 BFS 搜索任务剥离至 Web Worker 中执行。
2. **分批增量读取**：避免一次性载入全部 File 数组，使用批次队列分批读取和解码图片。
3. **分格式异步解压**：在 Worker 内部或者引入专门的图片加载队列来排队处理不同格式文件的解压，避免瞬时内存暴涨。
4. **延迟与懒加载渲染**：针对 `/results` 页面的 300+ 网格卡片引入虚拟列表（Virtual List）渲染。
5. **ZIP 分批归档**：使用 Stream 级分批压缩技术或将 ZIP 压缩任务移至 Worker。
6. **Tauri Native 底层引擎**：如果浏览器主线程依然无法承受，未来向 Tauri + Rust 原生底层引擎迁移，使用 Rust 进行高速文件读取、多线程解码以及 OpenCV 相似度聚类。
7. **专业大图防护**：对 HEIC / RAW 格式做原生层规划，在前端进行前置高分辨率降采样，避免海量高清大图把浏览器主线程直接撑爆。

---

## CORE-DUPLICATE-12 测试中止记录

### 测试状态：
- CORE-DUPLICATE-12 未完成。
- 100 张 JPG / PNG / WebP 混合格式测试已启动。
- 200 张和 300 张测试未执行。
- 本轮不能声明混合格式测试通过。

### 已完成到的流程：
- dev server 已启动。
- USE_SIGNAL_GROUPS_FOR_BATTLE 曾临时改为 true。
- 已通过 base64 直注 React Workspace 的方式导入 100 张混合格式真实图片文件。
- 已进入 /processing。
- /processing 已完成。
- /processing actual 耗时约 8.12 秒。
- 已进入 /results。
- 控制台曾打印：`[JS-TEST] Found duplicateGroupQA!`

### 中止原因：
- 测试卡在 `/results` 页面提取 React QA 指标阶段。
- headless 状态下 offscreen `QWebEnginePage` 遍历 React Fiber 树读取 `duplicateGroupQA` 时，Python 回调侧收到 `None`。
- 因指标被误判为未准备完成，测试脚本反复轮询并最终超时。
- 当前判断失败原因更像测试脚本读取 React 内部状态不稳定，不像产品主流程被破坏。

### 测试结论边界：
- 100 张混合格式测试不能判定通过。
- 100 张只完成到 `/results`。
- QA 双路指标没有完整获取。
- 200 / 300 张未执行。
- 不能说 JPG / PNG / WebP 混合格式已通过。
- 当前最多只能得出：100 张混合格式流程已进入 `/results`，`duplicateGroupQA` 曾被检测到，但测试脚本在指标读取阶段失败。

### 安全恢复：
- `USE_SIGNAL_GROUPS_FOR_BATTLE` 已恢复 `false`。
- `git diff -- src/lib/config/featureFlags.ts` 无 `true` 内容残留。
- production guard 未修改。
- 没有 src 代码脏变动。
- 测试图片未进入 Git。
- 没有 commit。
- 没有 push。

### 下一步：
- 不修改业务代码来适配这个 headless 测试脚本。
- 下一步应进入 `CORE-DUPLICATE-12-RETRY-PLANNING`。
- 重试规划应改用更稳定的 QA 指标读取方式，例如：
  - 页面可见 UI 指标
  - development console summary
  - 明确 dev-only 的 QA debug 输出
  - 不再依赖 React Fiber 遍历
- **CORE-DUPLICATE-12-RETRY-PLANNING 进展更新**：已在项目根目录下新建了 [duplicate_mixed_format_retry_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_retry_plan.md)。第一轮测试超时中止的原因为 headless QWebEnginePage 遍历 React Fiber 内部状态存在 environment 兼容问题，导致指标读取失败。在未来的重试（RETRY）过程中，将彻底弃用 React Fiber 遍历读取方案，改用读取控制台开发日志摘要（Console Summary）或可见 UI 指标作为首选校验机制，确保物理压力测试高可靠执行。
- **CORE-DUPLICATE-12-RETRY 实测结论**：混合格式测试 retry 阶段已顺利完成第一档（100 张）测试。本次测试彻底弃用了 React Fiber 遍历方式，改为通过 `console summary` 拦截开发日志抓取全部 QA 指标，证明该读取方式完全可行。虽然 100 张混合格式测试在 true 分支下校验完全对齐，但 100 张测试成功绝对不代表 200 张与 300 张规模也能全部通过，混合格式的分档压力测试仍然需要后续继续推进。
- **CORE-DUPLICATE-13-PLANNING 进展更新**：下一阶段的测试重点为中等批量 200 / 300 张 JPG / PNG / WebP 混合格式真实图片测试。测试方案将继续使用 `console summary` 开发日志拦截方式，严禁回退到 React Fiber 树遍历，以确保测试的稳定度与兼容性。详细规划文件见 [duplicate_mixed_format_200_300_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_200_300_plan.md)。
- **CORE-DUPLICATE-13 实测结论**：混合格式 100 / 200 / 300 张真实文件测试已全部执行完毕。200 张与 300 张均已通过。100张通过已不再是唯一实测结果，在新旧算法 parity 100% 对齐的同时，300 张压测中由于大卡片 DOM 重绘，results 网格出现了轻微滚动掉帧。测试边界正式更新为：不建议继续开展 500+ 大批量盲测，工作重点需转向主线程性能优化规划。
