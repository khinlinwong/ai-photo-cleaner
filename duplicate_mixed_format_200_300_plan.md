# AI Photo Cleaner 混合格式 200 / 300 张测试规划 - CORE-DUPLICATE-13-PLANNING

## 一、 当前基线

目前已完成以下准备及回归测试工作：
- 100 张 JPG / PNG / WebP 混合格式 true 分支测试已顺利跑通并获得验证。
- 测试样本物理配比：JPG：60 张，PNG：20 张，WebP：20 张。
- 测试样本文件总大小约 15.6 MB。
- 双路算法校验数据完全对齐：
  - `oldSimilarGroupCount` / `newSimilarGroupCount`：15 / 15
  - `oldSimilarGroupedPhotoCount` / `newSimilarGroupedPhotoCount`：60 / 60
  - `leaderMismatchCount`：0
- Photo Battle、skip、reset 以及 ZIP 导出均正常。
- 导出的保留区与淘汰候选区 ZIP 内容与页面 Results 物理分区完全一致。
- 导出的 ZIP 压缩包内所有图片完好地保留了原始 JPG / PNG / WebP 格式与后缀名，格式未遭损坏或修改。
- QA 指标提取已成功通过 `console summary` 拦截开发日志抓取，读取稳定高容错。
- 原有的 React Fiber 树遍历读取方案存在 headless 环境兼容性问题，已被彻底弃用。

---

## 二、 测试目标

`CORE-DUPLICATE-13` 的核心目标是规划并开展 200 / 300 张 JPG / PNG / WebP 混合格式真实图片在开发环境下的 true 分支物理压测，以评估中等批量下客观信号转换、擂台对决以及 ZIP 导出的健壮性与稳定性表现。

- **隔离性声明**：
  - 本测试**不是**生产环境（production）全量启用。
  - 本测试**不是**默认主流程的切换。
  - 测试开始前需要临时手动将灰度开关打开，但测试结束后必须物理恢复为 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`，保证 main 分支稳定交付。

---

## 三、 测试图片要求

测试所使用的照片集必须严格符合以下非隐私及物理存放的安全红线：

1. **数量规模**：
   - 第一档：200 张照片
   - 第二档：300 张照片
2. **格式配比**：
   - JPG：约占 60%
   - PNG：约占 20%
   - WebP：约占 20%
3. **安全防线**：
   - 必须是完全无隐私、非敏感的照片（如风景、建筑、静物等）。
   - **绝对严禁**使用任何家庭私人照片、私人肖像或任何涉及个人隐私的图像。
   - **绝对严禁**使用真实用户的隐私客户图片做测试。
   - **绝对严禁**使用包含身份证、车牌号、护照、银行卡、各种账单或含敏感公司信息的照片。
   - **绝对严禁**将测试图片复制到项目的任何物理目录内。
   - **绝对严禁**将任何测试图片 commit 或 push 到 Git 仓库历史中。
   - 只在开发服务器运行后，通过浏览器 File Input 临时手动载入。
   - 测试照片集建议隔离存放在项目物理目录外，例如：
     `D:\ai-photo-cleaner-mixed-format-test`
4. **本阶段暂不测试**：
   - HEIC / HEIF 格式
   - 相机 RAW 原始格式
   - GIF 动图
   - 视频文件
   - 单张大小超过 10MB+ 的超大手机原图

---

## 四、 分档测试策略

测试应当采用分档递增策略，逐步测试并拦截性能隐患：

### 第一档：200 张混合格式
- **目标**：验证在 100 张通过后，混合压缩格式扩展到 200 张量级时，解码以及聚类分析的开销增长。
- **重点**：观察 `/processing` 的 CPU 负载与 Canvas 处理，确认结果整理页面缩略图、对决擂台和 ZIP 二值打包是否发生明显延迟。
- **校验方式**：检查控制台的 `console summary` 是否依然可以单次且结构化输出，测试脚本能否精准读取 QA 属性。
- **拦截阀门**：只有当 200 张测试通过且无明显卡顿，才被允许推进 300 张测试。

### 第二档：300 张混合格式
- **目标**：测试浏览器原型在中批量混合压缩格式下的性能物理上限。
- **重点**：评估主线程占用，记录多轮 Photo Battle 交互响应。
- **限制约束**：如果 200 张已经产生明显的浏览器卡死或假死，**绝对禁止**继续执行 300 张压测；如果在 300 张中卡顿明显，**绝对禁止**推进 500+ 大批量规划，优先转入瓶颈排查与方案优化。

---

## 五、 测试前检查

在执行未来 CORE-DUPLICATE-13 物理压测前，测试人员必须确认以下 12 项检查：

1. **Git 干净度**：`git status --short` 确认当前工作区干净（除文档外无未提交 src 更改）。
2. **零 src 残留**：没有未提交或残留的 `src/` 代码脏变动。
3. **初始开关**：`src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值确实为 `false`。
4. **生产防护**：Context 内部 production 运行环境强制阻断 legacy 逻辑未做任何修改。
5. **构建正常**：执行 `npm run build` 成功。
6. **Lint 正常**：执行 `npm run lint` 通过，且不含阻碍性错误。
7. **存放隔离**：测试照片确实存放在项目源码目录外部，不在项目路径内。
8. **敏感审计**：再次确认测试照片不包含个人隐私、肖像或证件账单等敏感内容。
9. **工具就绪**：浏览器 DevTools 调试控制台已打开。
10. **指标方式**：采用 `console summary` 方式拦截获取指标，绝不遍历 React Fiber 树。
11. **Git 忽略**：已将测试外部路径排除在 Git 跟踪范围之外，测试图片决不进入 Git。
12. **测试脚本改动**：测试脚本本身已改用 Console Log 代理重写，不含任何 React 内部私有结构访问。

---

## 六、 200 张测试步骤

在执行第一档（200 张）测试时，必须严格执行以下物理步骤：

1. **临时修改开关**：将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 临时硬编码修改为 `true`。
2. **启动开发环境**：执行 `npm run dev`。
3. **打开桌面端**：访问 `http://localhost:3000/desktop`。
4. **载入测试大图**：选择外部目录中准备好的 200 张 JPG / PNG / WebP 混合格式非隐私图片进行导入。
5. **执行 AI 分析**：点击开始整理，进入 `/processing` 阶段。
6. **分析时间记录**：观察并记录 processing 页面的分析总体耗时。
7. **进入 results 面板**：分析完毕自动跳转至 `/results`，确认图片和网格卡片加载是否正常，JPG / PNG / WebP 缩略图是否都可正常预览。
8. **擂台触发核对**：检查 A/B PK 擂台对战是否自动弹出激活。
9. **获取 QA 指标**：检查测试脚本是否成功通过拦截 console summary 获取双路校验指标，如果不完整需辅以 UI DOM 数据，禁止读取 React Fiber。
10. **对局交互抽样**：手动或通过脚本模拟表决：保留左边、保留右边、两张都保留（`keep_both`）、两张都淘汰（`cull_both`）、跳过当前对决（`skip`），并观察未决队列和 reset 擂台的还原状态。
11. **ZIP 导出安全测试**：
    - 点击导出保留区 ZIP 并下载，记录耗时。
    - 点击导出淘汰候选区 ZIP 并下载，记录耗时。
    - 确认解压包里的图片划分是否与页面 results 二值结果完全一致。
    - 确认导出的图片没有被强制转码，均保留了原始格式及后缀名。
12. **异常记录**：检查在导入、分析、对决及打包的全部阶段里，有无任何明显的假死、无响应或控制台报错。
13. **失败终止机制**：若 200 张测试期间出现严重阻塞、解密失败或打包崩溃，**立刻终止测试，恢复 false 开关，禁止进行 300 张测试**。

---

## 七、 300 张测试步骤

只有当 200 张测试完全通过且表现优异时，方能开展第二档（300 张）压测：

1. **导入 300 张测试照片**：重新启动或清理页面后，导入 300 张混合格式非隐私图片。
2. **开始 AI 分析**：进入 `/processing`，记录 300 张真实图片分析解码的耗时。
3. **加载结果页面**：进入 `/results` 结果页，观察 300 张图片缩略图网格重绘时是否有感知卡顿。
4. **验证各格式预览**：逐一审查 JPG / PNG / WebP 在结果网格中是否均显示正常。
5. **Photo Battle 触发**：确认相似对决是否能对 300 张中识别出的聚类组自动触发弹出。
6. **记录对决信息**：记录本次 PK 的总轮次与组数。
7. **提取 QA 审计指标**：通过 console summary 校验 new 与 old 相似组和成员一致性。
8. **进行擂台表决**：依次抽样对对决组执行保留左、保留右、跳过等逻辑，记录更新延迟。
9. **ZIP 打包导出压测**：分别导出保留区 ZIP 与淘汰候选区 ZIP，测试中等批量下 JSZip 进行物理多格式打包的压缩性能与格式保持度。
10. **监控系统负载**：检查有无“页面无响应”浏览器级警告。
11. **测试归位收尾**：测试完成后，**立即将 USE_SIGNAL_GROUPS_FOR_BATTLE 常量改回 false**，杜绝将启用状态遗留在 featureFlags.ts 中。

---

## 八、 必须记录的 QA 指标

每一档位测试中，均须定量与定性记录以下 5 类共 30 项指标：

### 1. 基础物理指标
- **测试图片总数**（张）：
- **JPG / PNG / WebP 数量配比**（张）：
- **总文件物理大小**（MB）：
- **`/processing` 分析解码耗时**（秒）：
- **`/results` 首次网格渲染是否假死**（是/否）：
- **JPG / PNG / WebP 缩略图是否全都可以正常显示**（是/否）：
- **测试过程中是否有浏览器“页面无响应”警告**（是/否）：
- **控制台是否有未捕获异常报错**（是/否）：
- **有无特定格式无法预览或白屏**（是/否）：
- **是否有明显掉帧或卡顿**（是/否）：

### 2. 双路聚类算法比对指标
- **oldSimilarGroupCount**（旧算法组数）：
- **newSimilarGroupCount**（新信号组数）：
- **similarGroupCountMismatch**（组数是否不匹配）：
- **oldSimilarGroupedPhotoCount**（旧算法照片数）：
- **newSimilarGroupedPhotoCount**（新信号照片数）：
- **similarGroupedPhotoCountMismatch**（照片总数是否不匹配）：
- **leaderMismatchCount**（推荐组长 ID 不一致数）：

### 3. Photo Battle 擂台对决指标
- **对战擂台是否自动激活弹出**（是/否）：
- **PK 组数总计**（组）：
- **是否完成全部对局的表决**（是/否，若是抽样请注明比例）：
- **`skip`（跳过）功能是否正常**（是/否）：
- **`reset`（重置）功能是否正常**（是/否）：
- **是否产生了“保留”/“淘汰候选”之外的第三最终分类**（是/否）：

### 4. 数据安全导出指标
- **保留区 ZIP 打包导出是否成功**（是/否）：
- **淘汰候选区 ZIP 打包导出是否成功**（是/否）：
- **ZIP 导出的物理二值分区是否和页面 Results 完全一致**（是/否）：
- **ZIP 解压后的图片是否完整保留了原始格式与后缀名**（是/否）：
- **ZIP 打包平均耗时**（秒）：

### 5. 安全与回归指标
- **测试完毕后灰度开关是否改回 false**（是/否）：
- **`git diff -- src/lib/config/featureFlags.ts` 校验是否为空**（是/否）：
- **`npm run build` 和 `npm run lint` 是否通过**（是/否）：
- **是否有任何测试照片或压缩包进入了 Git 追踪范围**（是/否）：

---

## 九、 验收通过标准

只有当 200 / 300 张混合格式测试完美达成以下全部 21 项要求时，测试才被判定为通过：

1. `/desktop` → `/processing` → `/results` 全程跳转及加载无主线程假死与页面白屏。
2. `/processing` 能够对 JPG、PNG、WebP 进行高鲁棒性文件读取和解码。
3. `/results` 首次加载正常，大网格下三种格式的缩略图均可流畅显示。
4. 照片大网格滚动阻尼感合理，无明显的卡阻掉帧。
5. 没有任何一档测试触发浏览器的“页面无响应”等待弹出框。
6. Photo Battle 擂台在检测到相似组后能自动且定位准确地弹出。
7. 对决各按钮交互状态流转正常。
8. 擂台 `skip` 决断不引发第三分类，未表决照片安全留在待决池。
9. 点击擂台 `reset` 重置后，推荐组长、分组和待决状态无损复原。
10. `getUserVisibleBucket` 映射下的“保留区”与“淘汰候选区”页面渲染响应迅速。
11. 导出 ZIP 中的文件分布和 results 物理分区 100% 同步。
12. ZIP 解压出的图片格式没有发生损坏或后缀改写。
13. `oldSimilarGroupCount === newSimilarGroupCount`（允许由于汉明距离邻接表拓扑合并造成的少量可合理解释的微小差异）。
14. `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`。
15. `leaderMismatchCount === 0`（允许微小漂移，但不能破坏用户的物理保留区二值分发）。
16. 所有 QA 对比日志仅在 development 环境下输出。
17. 控制台不泄露图片的 Base64、绝对存放物理路径或完整照片实体对象。
18. 测试结束后，配置开关 100% 物理恢复为默认 `false`。
19. `git diff` 检查 featureFlags.ts 无 true 差异。
20. `npm run build` 成功。
21. `npm run lint` 通过，且不含 TypeScript/ESLint 阻塞错误。

---

## 十、 停止条件

在任何一档测试推进过程中，如果发生以下 9 项红线之一，**必须立刻中止继续测试并执行安全恢复**：

1. **第一档（200张）** 混合测试中发生明显假死、卡阻，主线程无法响应操作。
2. 页面在任何时候触发了浏览器级“页面无响应”的等待弹窗。
3. 自动化测试脚本检测到 console summary 无法读取，或者无法获取有效的对比摘要。
4. ZIP 打包导出时内存溢出或者打包生成的压缩包损坏、格式发生非预期变更。
5. 某种特定格式（如 WebP）在导入或分析时连续报错，或者在 results 网格中大量白屏。
6. 浏览器控制台出现大量未捕获的运行时异常（JS Error）。
7. 开发比对日志发生内存倾泻或刷屏。
8. 测试照片在测试中被意外复制进入了项目子目录，且有被 Git 跟踪的风险。
9. `USE_SIGNAL_GROUPS_FOR_BATTLE` 开关由于文本锁或编辑器故障，无法物理恢复为 `false`。

---

## 十一、 失败后的优化方向

如果在中批量压测（200 / 300 张）中表现出明显的效率低下或内存退化，禁止强行带病交付，而应将技术精力转向以下前端系统架构级别的深度性能优化方案规划：

1. **分批入队加载（Batch Queued Loader）**：避免使用 `Promise.all` 瞬时加载海量 File 对象，建立文件分批入队加载及 Canvas 降维机制，分段解码以削减内存波峰。
2. **Web Worker 离线计算层（Web Worker Offloading）**：将重算清晰度、感知哈希特征值计算以及 BFS 图连通分量相似聚类算法从主线程彻底剥离，移入独立的 Web Worker 进行并行计算，保持 UI 极佳的交互帧率。
3. **虚拟网格滚动（Virtual List Grid Rendering）**：对 results 面板的 300+ 卡片采用 Virtual Grid 进行按需 DOM 实例化，阻断海量 DOM 树造成的内存膨胀和滚动掉帧。
4. **流式压缩归档（Streaming ZIP Archiver）**：采用轻量流式或将 JSZip 打包计算移入后台 Worker，分担打包期间主线程的阻塞开销。
5. **Tauri 底层硬件加速（Tauri + Rust Native Engine）**：若前端沙箱对 300+ 大批量的承载仍不达标，建议启动向桌面端 Tauri 原生架构的迁移，利用 Rust 编写底层多线程物理文件读取、OpenCV 快速解码和感知聚类，前端仅用作展示，彻底消除浏览器沙箱局限。
6. **专业大图防护（RAW/HEIC Guard）**：为 HEIC / RAW 设计专门的 native 前置降采样管道，避免多张 20MB+ 巨型图直接挤爆浏览器可用内存上限。

---

## CORE-DUPLICATE-13 200 / 300 张混合格式实测结果

### 测试范围
- 本轮执行 200 / 300 张 JPG / PNG / WebP 混合格式 true 分支测试。
- 测试图片为非隐私、非敏感的外部测试图片。
- 测试图片存放在项目目录外：
  `D:\ai-photo-cleaner-mixed-format-test`
- 测试图片未进入 Git。
- 本阶段不包含 HEIC / RAW / GIF / 视频 / 10MB+ 超大手机原图。

### 测试图片组成
200 张档位：
- JPG：120 张。
- PNG：40 张。
- WebP：40 张。
- 总文件大小约 31.2 MB。

300 张档位：
- JPG：180 张。
- PNG：60 张。
- WebP：60 张。
- 总文件大小约 46.8 MB。

### Feature Flag 状态
- 测试前 `USE_SIGNAL_GROUPS_FOR_BATTLE` = `false`。
- 测试中临时改为 `true`。
- 测试结束后已恢复 `false`。
- `git diff -- src/lib/config/featureFlags.ts` 无 `true` 残留。
- production guard 未修改。

### QA 读取方式
- 使用 console summary。
- 未使用 React Fiber。
- 未读取 React 内部私有结构。

### 200 张测试结果
- `/desktop` 正常。
- `/processing` 正常。
- `/processing` 耗时 17.65 秒。
- `/results` 正常。
- results 首次渲染正常。
- JPG 正常预览。
- PNG 正常预览。
- WebP 正常预览。
- Photo Battle 自动触发。
- PK 组数：30。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常，未产生第三最终分类。
- reset 正常。
- 保留区 ZIP 正常。
- 淘汰候选区 ZIP 正常。
- ZIP 和页面分区一致。
- ZIP 保留 JPG / PNG / WebP 原始格式和后缀。
- 无明显卡顿。
- 无浏览器无响应。
- 无控制台报错。
- 无第三最终分类。

### 200 张 QA 指标
- oldSimilarGroupCount: 30
- newSimilarGroupCount: 30
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 120
- newSimilarGroupedPhotoCount: 120
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0

### 300 张测试结果
- `/desktop` 正常。
- `/processing` 正常。
- `/processing` 耗时 26.04 秒。
- `/results` 正常。
- results 首次渲染正常。
- JPG 正常预览。
- PNG 正常预览。
- WebP 正常预览。
- Photo Battle 自动触发。
- PK 组数：45。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常，未产生第三最终分类。
- reset 正常.
- 保留区 ZIP 正常。
- 淘汰候选区 ZIP 正常。
- ZIP 和页面分区一致。
- ZIP 保留 JPG / PNG / WebP 原始格式和后缀。
- 出现轻微滚动掉帧，但仍可交互。
- 无浏览器无响应。
- 无控制台报错。
- 无第三最终分类。

### 300 张 QA 指标
- oldSimilarGroupCount: 45
- newSimilarGroupCount: 45
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 180
- newSimilarGroupedPhotoCount: 180
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0

### 结论
- 200 张 JPG / PNG / WebP 混合格式测试通过。
- 300 张 JPG / PNG / WebP 混合格式测试通过。
- console summary 读取方式稳定。
- 新旧相似组结果完全对齐。
- leaderMismatchCount 为 0。
- Photo Battle、skip、reset、ZIP 导出均正常。
- ZIP 保留原始 JPG / PNG / WebP 格式。
- 当前仍必须保持 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`。
- 不允许默认启用 `true`。
- 不允许 production 启用 `true`。

### 性能边界
- 200 张耗时 17.65 秒，可接受，但已经不是轻量体验。
- 300 张耗时 26.04 秒，勉强可接受。
- 300 张 results 网格出现轻微滚动掉帧，说明浏览器原型已经接近舒适上限。
- 不建议继续 500+ 盲测。
- 下一步应转入性能优化规划，而不是继续扩大测试。

### 建议后续优化方向
- Web Worker 后台分析。
- 分批处理。
- 虚拟列表 / 虚拟网格。
- 延迟缩略图。
- ZIP 分批或流式导出。
- 后续 Tauri / native engine。
- **CORE-PERFORMANCE-1-PLANNING 进展更新**：鉴于 300 张物理压测出现的轻微掉帧及浏览器性能瓶颈瓶颈，本阶段决定不再继续进行 500+ 图片大批量的盲目压测。工作重点已正式转移到性能优化规划上，已在项目根目录下新建了专门的规划文件 [performance_optimization_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/performance_optimization_plan.md)。
- **CORE-PERFORMANCE-2-PLANNING 进展更新**：性能优化的第一阶段已规划采用 results 自研虚拟网格与缩略图懒加载方案，用于安全、低风险地解决卡片 DOM 节点膨胀和内存消耗。已新建了专项方案文件 [results_virtual_grid_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/results_virtual_grid_plan.md)，此阶段不涉及 Web Worker 消息通信以规避复杂的状态流转风险。
