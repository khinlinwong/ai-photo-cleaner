# AI Photo Cleaner 真实图片文件压力测试规划 - CORE-DUPLICATE-11-PLANNING

## 一、 测试目标

`CORE-DUPLICATE-11` 的目标是规划并验证真实 100-300 张物理图片文件在本地开发环境（development）中临时手动启用 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 灰度通道时的系统性能与稳定性。

### 本测试与 CORE-DUPLICATE-10 的核心区别

- **CORE-DUPLICATE-10 (元数据仿真测试)**：
  - 测试对象为 200 张在内存中通过代码构建的虚拟仿真照片元数据（Perceptual Hash、清晰度、得分等）。
  - 重点验证相似哈希检测、连通图 BFS 分组拓扑、对决状态机数据流等算法链路逻辑。
  - 不涉及也无法验证真实图片文件的磁盘 I/O 读取、解码、Canvas 像素读取以及 UI 缩略图渲染压力。
- **CORE-DUPLICATE-11 (真实图片文件压力测试)**：
  - 测试对象为 100-300 张存放在磁盘上的真实本地图片文件。
  - 重点验证浏览器运行该应用在真实物理环境下的全链路文件处理压力。
  - 覆盖图片读取、内存解码、Canvas 像素重绘与灰度计算、DOM 网格缩略图重排重绘、大队列对战流畅度、ZIP 压缩打包开销以及浏览器内存与主线程响应时长。

---

## 二、 测试图片选择标准

为了确保数据合规及开发隔离，测试照片集必须符合以下硬性合规防线：

1. **数量规模**：选取 100-300 张物理图片。
2. **敏感安全红线**：必须是完全无隐私、非敏感的照片（如风景、街拍、公共建筑等）。
3. **禁止私人照**：绝对禁止使用家庭私人照片、私人肖像或涉及个人隐私的图像。
4. **禁止证件敏感图**：绝对禁止使用包含身份证、车牌号、护照、银行卡、各类账单、发票、合同等敏感信息的照片。
5. **禁止客户照片**：绝对禁止使用真实用户的任何隐私客户照片测试。
6. **不复制进项目目录**：绝对禁止将测试照片复制到项目源码的任何物理目录内。
7. **禁止提交到 Git**：绝对禁止将测试图片 commit 或 push 到 Git 仓库历史中。
8. **载入形式**：仅在开发服务器运行时通过浏览器 File Input 临时选择并载入内存，测试完毕后关闭浏览器即销毁。
9. **外部独立存放**：建议将测试照片单独存放在项目目录外的独立文件夹中，例如：
   - `D:\ai-photo-cleaner-test-photos`
   - 或桌面以外的其他临时外部测试文件夹。
10. **清理机制**：测试任务完成后可立即物理删除该外部照片集，不留隐患。

### 建议图片组成：
- **格式**：100-300 张真实 `jpg` / `png` / `webp` 图片。
- **相似组**：10-20 组真实的连拍 / 相似照片（每组 2-5 张）。
- **普通干扰组**：50 张以上完全独立的非相似干扰照片。
- **模糊图片**：少量对焦不准或抖动模糊的图片。
- **曝光异常图片**：少量严重过曝或欠曝的照片。
- **多种尺寸**：包含多种不同分辨率大小的照片。
- **格式避让**：本阶段先不引入超大 RAW / HEIC 格式的物理大图，专心摸底通用 Web 格式的性能瓶颈。

---

## 三、 分阶段测试方式

为了避免一次性载入 300 张物理图片直接导致浏览器主线程挂起或崩溃，测试将划分为以下三档逐步推进：

### 第一档：100 张图片
- **目标**：验证基础真实文件流的处理闭环。
- **重点**：观察 `/processing` 的 Canvas 像素读取与 dHash 运算是否顺畅、`/results` 网格缩略图首次渲染耗时，以及 ZIP 导出一致性。

### 第二档：200 张图片
- **目标**：对齐 `CORE-DUPLICATE-10` 仿真元数据的规模，进行双路指标和性能的“真实 vs 虚拟”横向对比。
- **重点**：观察内存占用增量、缩略图网格滚动是否有延迟，以及大队列 ZIP 打包压缩压力。

### 第三档：300 张图片
- **目标**：验证当前浏览器前端主线程处理中批量图片的极限承载能力。
- **硬性约束**：如果第二档（200张）测试已出现明显的浏览器卡顿，则中止测试，**禁止继续执行 300 张压测**。若 300 张测试中卡顿严重，则中止并判定主线程瓶颈，后续禁止测试 500+。

---

## 四、 测试前检查

在手动将 feature flag 修改为 true 之前，执行人必须确认以下 12 项检查条件：

1. **Git 工作区**：执行 `git status --short` 确认当前工作区干净（无未 commit 的 src 改动）。
2. **GitHub 对齐**：当前 main 分支最新文档 commit 已成功 push 到了远程仓库。
3. **开关初始状态**：`src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
4. **生产隔离守卫**：Context 内部 production 运行时环境防护逻辑未做任何改动。
5. **构建正常**：`npm run build` 顺利通过。
6. **Lint 正常**：`npm run lint` 顺利通过。
7. **图片存放隔离**：测试照片确实存放在项目源码目录外部，不在项目路径内。
8. **敏感内容核对**：核对测试照片不包含任何个人隐私、肖像或证件账单等敏感内容。
9. **开发调试准备**：浏览器开发者工具 DevTools 已打开并切换至 Console 窗格。
10. **内存观察工具**：开启 Chrome Task Manager（浏览器任务管理器）或操作系统的任务管理器以记录内存开销。
11. **系统环境纯净**：关闭其他大型 CPU/内存占用应用，防止造成卡顿误判。
12. **Git 忽略**：检查确认测试图片文件夹绝不会被 Git 追踪。

---

## 五、 临时 true 测试步骤

当执行 CORE-DUPLICATE-11 压力测试时，必须严格执行以下动作步骤：

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
5. **访问桌面整理页**：
   在浏览器中打开 `http://localhost:3000/desktop`。
6. **导入第一档（100张）真实图片**：
   通过文件选择器，手动选择已准备好的 100 张本地非隐私测试图片并载入。
7. **观察并记录 `/processing` 阶段表现**：
   观察进度条运行流畅度，有无卡死崩溃，并记录完成耗时。观察 Chrome 任务管理器中内存的上升趋势。
8. **观察并记录 `/results` 网格加载**：
   进入结果页，观察首次加载的耗时、卡片网格滚动是否顺畅、缩略图是否正常显示，Photo Battle 擂台对决是否自动被激活弹出。
9. **执行 Photo Battle 抽样测试**：
   进行不少于 5 轮的对决操作，验证以下状态机交互：
   - 保留左图（`keep_left`）/ 保留右图（`keep_right`）。
   - 两张都保留（`keep_both`）。
   - 两张都标记为淘汰候选（`cull_both`）。
   - 跳过对局（`skip`），检查未决照片是否正常留在待决队列，未产生第三最终分类。
   - 重置对战（`reset`），检查对战状态是否能无损复原。
10. **执行 ZIP 导出一致性测试**：
    - 导出保留区 ZIP 并下载。
    - 导出淘汰候选区 ZIP 并下载。
    - 记录 ZIP 打包压缩是否耗时过长，确认导出的 ZIP 文件内容和 results 页面分区 100% 对齐一致。
11. **记录本档 QA 指标**。
12. **推进第二档（200张）测试**：
    若 100 张测试正常，清理工作区后，导入 200 张真实图片重复上述步骤 7-11。
13. **推进第三档（300张）测试**：
    若 200 张测试正常且无明显卡顿，导入 300 张真实图片重复上述步骤 7-11。
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

CORE-DUPLICATE-11 测试执行人必须详细记录以下指标：

### 1. 基础指标
- **图片数量**（张）：
- **图片格式组成**：
- **单张图片平均大小**（KB/MB, 估算）：
- **测试总文件大小**（MB, 估算）：
- **`/processing` 真实分析耗时**（秒）：
- **`/results` 首次网格渲染是否正常**：
- **测试过程中是否出现浏览器级无响应**：
- **控制台是否出现任何红色报错**：
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
- **ZIP 打包下载大致耗时**（秒）：
- **ZIP 归档划分是否与页面 results 物理分区 100% 一致**：
- **测试结束后配置是否已恢复为 false**：
- **`git diff` 校验是否完全无 true 残留**：
- **`npm run build` 和 `npm run lint` 是否通过**：
- **是否有测试图片遗留于项目目录或 Git 暂存区**：

---

## 七、 验收通过标准

只有当满足以下 20 项标准时，才被判定为真实图片文件压力测试通过：

1. `/desktop` → `/processing` → `/results` 全程无任何假死与页面白屏。
2. `/processing` 阶段 Canvas 诊断、亮度与清晰度分析正常流动，并能顺利完成。
3. `/results` 首次网格渲染流畅，卡片缩略图可正常显示。
4. 照片卡片滚动流畅，无明显掉帧。
5. 页面没有触发浏览器级“页面无响应”的等待弹窗。
6. Photo Battle 擂台可根据实际分组数自动触发并激活。
7. 至少进行一轮完整的 Photo Battle 交互且状态更新无卡滞。
8. `skip` 操作将未决照片保留在待决队列，未引入第三分类。
9. `reset` 重置擂台后状态无损复原。
10. “保留”与“淘汰候选”工作区分区重绘流畅。
11. ZIP 导出压缩与 results 页面二值展示物理一致。
12. 运行比对日志仅在 development 环境下输出。
13. 控制台日志不含图片的本地物理路径、Base64 以及完整照片实体数据。
14. `oldSimilarGroupCount === newSimilarGroupCount`（如有少量因浮点误差或精度造成的差异，需有明确技术解释）。
15. `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`。
16. `leaderMismatchCount === 0`（如有偏离需确认不影响用户的保留二值包）。
17. 测试完毕后开关彻底恢复为默认 `false` 值。
18. `git diff` 检查 featureFlags.ts 没有任何 true 差异。
19. `npm run build` 成功。
20. `npm run lint` 成功。

---

## 八、 中止与停止条件

在测试过程中，如果出现以下任何一种异常，**必须立即中止继续扩大测试（硬截断）**：

1. **第一档（100张）** 测试已出现明显严重的卡顿或界面无法操作。
2. **第二档（200张）** 测试中浏览器产生“页面无响应”弹窗。
3. **结果页渲染假死**： results 网格卡片渲染时内存暴涨，引起浏览器标签页崩溃。
4. **Photo Battle 无法激活**：对局状态机阻塞，擂台组件无法渲染或点击无响应。
5. **ZIP 导出内存溢出**：由于文件过多，JSZip 压缩打包时发生 Out of Memory 崩溃。
6. **控制台异常**：控制台连续抛出 React 渲染死循环或 TypeScript 运行时未捕获错误。
7. **QA 日志刷屏**：对 100+ 图片两两汉明距离比较日志瞬间刷满 console。
8. **Git 泄露风险**：测试图片文件夹意外被复制到项目内并被 `git status` 追踪。
9. **开关异常**：`USE_SIGNAL_GROUPS_FOR_BATTLE` 变量由于编辑器冲突无法归位恢复为 `false`。

### 中止测试后的处理流程：
1. **一键恢复**：立即将开关改回 `false`。
2. **拒绝带脏提交**：绝不 commit `true` 分支，也决不 push。
3. **提报只读分析**：记录卡死时的图片数量、发生阶段（Canvas 分析 / 网格渲染 / Battle 对局 / ZIP 打包）、内存峰值、控制台报错 Stack，提报给 Codex 进行 `CORE-DUPLICATE-11-FAIL-READ` 只读分析，寻找性能解耦与优化思路。

---

## 九、 性能瓶颈与后续优化方向

如果真实物理图片测试结果表明在 100-300 张下出现了主线程挂起或明显的卡顿风险，表明完全在前端主线程同步执行 O(n²) 级 Perceptual Hash 比对、图片解码和内存 ZIP 打包已达性能天花板。

后续不应继续强行扩大测试规模（严禁 500+ 真图强测），而应当启动以下优化方案的设计：

1. **Web Worker 异步解耦**：将 Canvas 像素读取、感知哈希比对以及连通分量 BFS 搜索任务剥离至 Web Worker 中执行，释放 UI 主线程。
2. **分批增量读取**：避免一次性载入全部 File 数组，使用批次队列分批读取和解码图片。
3. **Hash Bucket 预筛选**：基于粗筛机制（如 pHash 前缀筛或 LSH 局部敏感哈希）划分存储桶，将 O(n²) 比对数量降低到接近 O(n)。
4. **延迟与懒加载渲染**：针对 `/results` 页面的 300+ 网格卡片引入虚拟列表（Virtual List）渲染，按需实例化缩略图，避免海量 DOM 节点造成的重绘假死。
5. **ZIP 分批归档**：使用 Stream 级分批压缩技术或将 ZIP 压缩任务移至 Worker。
6. **Tauri Native 底层引擎**：如果浏览器主线程依然无法承受，未来向 Tauri + Rust 原生底层引擎迁移，使用 Rust 进行高速文件读取、多线程解码以及 OpenCV 相似度聚类，彻底免除前端负担。

---

## CORE-DUPLICATE-11 真实 100/200/300 张 BMP 文件实测结果

测试范围：
- 本轮执行真实 100 / 200 / 300 张物理图片文件 true 分支测试。
- 测试图片为非隐私、非敏感的真实 BMP 文件。
- 测试图片通过仿真生成脚本创建，但文件本身是真实物理图片文件。
- 测试图片位于项目外部目录 D:\ai-photo-cleaner-test-photos。
- 测试完成后图片已物理删除。
- 测试图片未进入 Git。
- 图片格式为 24-bit 无压缩 BMP。
- 分辨率包括 400x300、300x200、200x200。
- 300 张总文件大小约 108 MB，单张约 360 KB。

Feature Flag 状态：
- 测试前 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 测试中临时改为 true。
- 测试结束后已恢复 false。
- git diff -- src/lib/config/featureFlags.ts 无 true 残留。
- production guard 未修改。

100 张测试结果：
- /desktop 正常。
- /processing 正常。
- /processing 耗时 947.95 ms。
- /results 正常。
- results 首次渲染正常。
- 缩略图正常。
- Photo Battle 自动触发。
- PK 组数：4 组。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常。
- reset 正常。
- 保留区 ZIP 正常。
- 淘汰候选区 ZIP 正常。
- ZIP 和页面分区一致。
- 无卡顿。
- 无浏览器无响应。
- 无控制台报错。
- 无第三最终分类。
- oldSimilarGroupCount: 4
- newSimilarGroupCount: 4
- oldSimilarGroupedPhotoCount: 16
- newSimilarGroupedPhotoCount: 16
- leaderMismatchCount: 0

200 张测试结果：
- /processing 耗时 1653.18 ms。
- /results 正常。
- Photo Battle 自动触发。
- PK 组数：7 组。
- ZIP 正常。
- ZIP 生成时间 1318.48 ms。
- 无卡顿。
- 无浏览器无响应。
- 无控制台报错。
- oldSimilarGroupCount: 7
- newSimilarGroupCount: 7
- oldSimilarGroupedPhotoCount: 28
- newSimilarGroupedPhotoCount: 28
- leaderMismatchCount: 0

300 张测试结果：
- /processing 耗时 2469.56 ms。
- /results 正常。
- Photo Battle 自动触发。
- PK 组数：7 组。
- ZIP 正常。
- ZIP 生成时间 1833.31 ms。
- 无卡顿。
- 无浏览器无响应。
- 无控制台报错。
- oldSimilarGroupCount: 7
- newSimilarGroupCount: 7
- oldSimilarGroupedPhotoCount: 28
- newSimilarGroupedPhotoCount: 28
- leaderMismatchCount: 0

结论：
- 真实 100 / 200 / 300 张 BMP 文件 true 分支测试通过。
- old/new 相似组结果完全对齐。
- leaderMismatchCount 为 0。
- Photo Battle、skip、reset、ZIP 导出均正常。
- 当前仍必须保持 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 不允许默认启用 true。
- 不允许 production 启用 true。

测试边界：
- 本轮测试覆盖小尺寸 24-bit 无压缩 BMP 文件。
- 本轮可说明 BMP 文件读取、解码、Canvas、缩略图渲染、Photo Battle 和 ZIP 在 300 张以内表现可接受。
- 本轮不能代表 JPG / PNG / WebP 的压缩解码压力。
- 本轮不能代表 HEIC / RAW。
- 本轮不能代表 10MB 手机大图。
- 本轮不能代表高分辨率相册。
- 下一步如继续测试，应规划 500+ BMP 分档测试，或另行规划 JPG / PNG / WebP 混合真实图片测试。
