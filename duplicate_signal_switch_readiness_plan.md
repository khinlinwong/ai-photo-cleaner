# AI Photo Cleaner Signal Groups 灰度切换就绪度评估 - CORE-DUPLICATE-SIGNAL-SWITCH-PLANNING

## 一、 当前已完成的验证成果

我们已经通过多维度对 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 分支下的聚类逻辑和 UI 表现进行了大量回归测试，具体包括：

1. **Demo true 分支测试**：Demo 测试用例在启用灰度分支下，全部交互正常，决策流无偏差。
2. **35 张非隐私本地图片测试**：本地真实物理图片的灰度测试正常通过。
3. **200 张元数据仿真测试**：超大批量照片元数据模拟跑通，确认比对数据精度。
4. **100 / 200 / 300 张真实 BMP 文件测试**：超大单像素无损图片流正常读取与聚类。
5. **100 / 200 / 300 张 JPG / PNG / WebP 混合格式测试**：成功通过各种真实 JPG / PNG / WebP 混合格式测试图片的聚类测试。
6. **VirtualPhotoGrid 接入后回归**：结果页虚拟滚动网格引入后，100 / 300 张大批量照片测试无卡顿，流畅流转。
7. **window.__AI_PHOTO_CLEANER_QA__ 稳定读取**：成功通过新增的 window 挂载方式取代原 Fiber 遍历和 Console 劫持提取，在当前回归中稳定实现数据抓取。
8. **100 / 300 张 parity 指标重新验证**：
   - **100 张**：old/new group count 为 3/3，grouped photo 为 69/69，leaderMismatchCount 为 0。
   - **300 张**：old/new group count 为 6/6，grouped photo 为 85/85，leaderMismatchCount 为 0。
9. **production 不暴露验证**：确认 `window.__AI_PHOTO_CLEANER_QA__` 在 production 验证中未暴露（为 `undefined`）。

## 二、 仍不建议直接默认 true 的原因

尽管回归测试数据在当前样本下对齐，但由于以下边界条件和风险考量，现阶段依旧不能在生产环境直接将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认开启为 `true`：


1. **开发环境受限**：当前 true 分支的 QA 全局属性只注入在 development 模式。
2. **生产硬防护保留**：SSR 及 production 运行期防污染守卫必须严格存在。
3. **缺乏真实相册长期测试**：目前所有测试均在本地预设测试集下完成，未经过真实用户长时间、大批量的多场景相册行为检验。
4. **未覆盖 HEIC / RAW 格式**：移动端最常见的苹果 HEIC 与专业 RAW 格式图片尚未在此测试集中得到完整覆盖。
5. **未进行 500+ 大型混合相册压测**：目前的上限为 300 张，对更大级别的相册表现未知。
6. **计算耗时限制**：前端 JS 线程在处理 300 张图片时，包含图像分析与聚类算法的总体处理耗时仍在 30 秒级别，存在卡顿或浏览器挂起风险。
7. **Battle 接管路径偏年轻**：由 signal groups 完全接管 Photo Battle 流程的机制仍处于灰度阶段，代码复杂度较高，需要渐进式灰度发布。
8. **Legacy 依然稳定**：传统的 detectDuplicates 主流程性能稳定，经历过线上验证，在没有把握的情况下不应对其强行替代或移除。
9. **超大 ZIP 下载中断风险**：大尺寸 JPG 压测暴露出超大体积（1GB+）淘汰候选区大包在下载时被浏览器 `DownloadInterrupted` 中断的缺陷。该底层稳定性漏洞是灰度切换就绪度中必须优先克服的阻塞项，因此在未彻底解决前绝不能作为生产环境默认开启 `true` 分支的依据。
10. **重复性稳定性验证前置**：在 production 开启默认 true 之前，必须先在 development 临时 true 环境下通过同一测试集的多轮重复运行稳定性验证。在未彻底通过该稳定性验证并妥善解决可能存在的内存与句柄释放泄露隐患前，生产环境必须绝对锁定为 false 强制 legacy，继续保持 development 临时 true 测试的模式。


## 三、 下一阶段灰度切换策略规划

为了控制系统性风险，建议将 signal groups 的灰度切换分为三个渐进式阶段：

- **阶段 A：继续保持默认 false**
  - `USE_SIGNAL_GROUPS_FOR_BATTLE = false`。
  - production 强制 legacy。
  - development 开发阶段可临时通过修改 featureFlags.ts 为 `true` 做本地测试与脚本验证。
  - 核心持续使用 `window.__AI_PHOTO_CLEANER_QA__` 进行比对指标的读取。
- **阶段 B：development-only 常态灰度**
  - 维持 production 环境强制 legacy 不动。
  - 允许在开发环境中常态化开启 true 选项进行日常开发测试。
  - 每次运行比对必须稳定记录以下 7 个核心 Parity 维度：
    - old/new group count
    - grouped photo count
    - leaderMismatchCount
    - Photo Battle 弹窗流转
    - ZIP 安全导出
    - 是否出现第三分类（当前验证中已收敛于保留/淘汰候选）
    - production 不暴露属性
- **阶段 C：考虑内部 beta 试用**
  - 只有在阶段 B 累积通过了更多样化的真实相册数据测试后，才考虑对内部白名单或开发者测试版默认开启。
  - beta 状态在规划中需具备一键热退回到 false（legacy）的灾备能力。
  - 绝不对普通生产用户默认开启。

## 四、 下一步测试建议

为了更真实地贴近生产场景，后续测试中不建议盲目扩大数量到 500+，而应优先优化测试集的“真实性”：

1. **采用更真实的样本**：测试图片应选择 100-300 张接近手机真实相册的照片。
2. **照片特征丰富度**：测试集中必须加入连拍照片、相似度极高的连拍细节图、低像素截图、偏色/曝光异常图、模糊图、不同纵横比尺寸照片等。
3. **格式隔离**：在未有专门的 HEIC/RAW 解码与分析规划前，回归测试集仍不包含 HEIC / RAW 图片，保持格式隔离。
4. **自动化读取**：继续使用 `window.__AI_PHOTO_CLEANER_QA__` 在 results 页面获取 parity 摘要。
5. **测试完毕复原**：所有本地灰度开启测试结束后，必须立即把开关还原为 `false`。
6. **非 production 默认开启**：本测试处于外部隔离的开发测试状态，production 生产环境不建议默认开启 `true`，以防带入线上环境。
7. **大尺寸 JPG 物理压力测试**：由于以往的测试集图片单张体积过小，必须补充 100/200 张 3MB-10MB 的非隐私大尺寸 JPG 物理压力测试，用于专门补足浏览器 I/O、Canvas 像素分析、内存占用及 ZIP 打包导出的压强验证。

## 五、 关于是否移除 legacy 逻辑的结论

**结论：当前暂不建议移除 legacy detectDuplicates 主流程。**

原因在于：
1. **生产基石**：legacy 逻辑是目前 production 环境的唯一基石，直接关系到线上业务的稳定与否。
2. **灰度定位**：signal groups 仍然定位于“灰度验证”阶段，没有经历过真实大并发或超大相册的线上检验。
3. **回退依赖**：保留 legacy 的代码链路能够为我们提供随时、快速的回退路径，保证系统极高的抗风险度。
4. **债务渐进拆解**：虽然 duplicate.ts 中新旧逻辑共存导致了一定的状态写入债务，但应当通过后期架构优化来渐进拆解，不应在此阶段进行强行割裂。

## 六、 后续 Checkpoint 路线规划

1. **`CORE-DUPLICATE-SIGNAL-SWITCH-QA`**：
   - Codex 对本就绪度评估文档进行只读审查。
2. **`CORE-DUPLICATE-REALISTIC-ALBUM-PLANNING`**（已完成）：
   - 已完成更真实的 100-300 张非隐私相册测试集的规划，新建了专属规划文档。
3. **`CORE-DUPLICATE-REALISTIC-ALBUM`**（已完成）：
   - 在开发环境下临时开启 `true` 分支，成功完成了 100 张和 300 张真实相册感非隐私 mock 样本的测试。
   - 双路 parity 数据在当前样本下完成对齐，验证了 Photo Battle、ZIP 二值导出、虚拟滚动与二值分类等功能在此样本下均运转正常。
   - 测试完毕后，开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已顺利恢复为 `false`。
   - 依然存在明确的测试边界（如：未覆盖真实客户相册长期验证、未覆盖 HEIC / RAW 格式、且测试 mock 图片总体积较小，不代表真实大图 I/O 压力），因此依然不建议 production 默认 true，且 legacy 稳定主流程必须全量保留。
4. **`CORE-DUPLICATE-SIGNAL-BETA-PLANNING`**（已完成）：
   - 评估前述 100 / 300 张真实相册感测试结果，并深入分析是否可以进入 development-only 常态灰度。明确仅评估开发环境常态灰度，不评估 production 默认 true。
5. **`CORE-DUPLICATE-SIGNAL-BETA-QA`**（已完成）：
   - Codex 对 beta readiness 规划进行只读审查。
6. **`CORE-DUPLICATE-LARGE-JPG-PLANNING`**（已完成）：
   - 规划 100 / 200 张 3MB-10MB 大尺寸 JPG 非隐私测试，用于补足浏览器 I/O、Canvas、内存和 ZIP 压力验证。
7. **`CORE-DUPLICATE-LARGE-JPG-DOCS-COMMIT-PUSH`**（已完成）：
   - 提交大尺寸 JPG 测试规划文档并推送。
8. **`CORE-DUPLICATE-LARGE-JPG`**（已完成）：
   - 运行大尺寸 JPG 物理压测，算法 parity 正常，但发现 200 张大文件 ZIP 导出中断（`DownloadInterrupted`）漏洞。
9. **`CORE-ZIP-LARGE-FILE-FIX-PLANNING`**（已完成）：
   - 规划大文件 ZIP 下载中断修复方案，新建 `zip_large_file_fix_plan.md`。
10. **`CORE-ZIP-LARGE-FILE-FIX-QA`**（已完成）：
    - Codex 对大文件 ZIP 下载修复方案进行只读审查。
11. **`CORE-ZIP-LARGE-FILE-FIX`**（已完成）：
    - 实施 Object URL 延迟 120 秒释放最小修复。100张（643MB）通过，但 200张（1.27GB）超大单包依然失败。
12. **`CORE-ZIP-BATCH-EXPORT-PLANNING`**（已完成）：
    - 规划分批 ZIP 导出方案，新建 `zip_batch_export_plan.md`，确立 500MB / 50张串行限流逻辑。
13. **`CORE-ZIP-BATCH-EXPORT`**（已完成）：
    - 在 results 页面中增加局部常量与辅助函数，通过 `async/await` 串行完成多包 ZIP 压缩打包与自动下载触发。
14. **`CORE-ZIP-BATCH-EXPORT-REGRESSION`**（已完成）：
    - 200张 JPG 大相册淘汰区（3包）分批导出与物理包压缩尺寸检验成功，规避了单包 1GB+ 溢出隐患，当前回归中规避了中断 Bug。
15. **`CORE-STABILIZE-SNAPSHOT-PLANNING`**（已完成）：
    - 整理当前阶段的稳定化成果快照并生成 `core_stabilize_snapshot.md`。由于切换条件目前仍未满足 production true 且缺乏真实复杂客户相册运行检验，后续继续保持**阶段 A**（默认为 false，仅在开发环境做临时 true 测试），绝不移除 legacy。
16. **`CORE-DUPLICATE-REPEATABILITY-PLANNING`**（已完成）：
    - 规划同一测试集在 development 临时 true 分支下的重复运行稳定性测试，编写并建立 `duplicate_repeatability_test_plan.md` 规划方案，明确规定在开启开发环境常态灰度（Beta）或 production 默认 true 之前，必须先完成 100 / 200 张大尺寸 JPG 的多轮重复性稳定性测试，且生产环境继续强制锁定为 false，继续保持 development 临时 true 状态进行安全性与资源释放验证。该规划已通过 Codex QA 审查，未执行实际测试。
17. **`CORE-DUPLICATE-REPEATABILITY`**（已完成）：
    - 在开发环境下临时开启 `true` 分支，执行 100 张和 200 张大尺寸 JPG 连续 3 轮重复性稳定性测试。100张通过，但 200张 Round 1 导出第 3 包时由于主线程 Peak 内存冲高至 4454.17MB 触发了 `DownloadInterrupted` 导致测试中止。特性开关已物理恢复为 `false`。
18. **`CORE-ZIP-BATCH-PARAM-TUNING-PLANNING`**（已完成）：
    - 针对 200 张重复性测试由于分批大包叠加触发的 `DownloadInterrupted` 中断，规划更保守的分批参数调优方案（300MB/30张/3000ms），并建立 `zip_batch_param_tuning_plan.md`。
19. **`CORE-ZIP-BATCH-PARAM-TUNING`**（已完成）：
    - 实施参数调优，将 parameters 收缩。
20. **`CORE-ZIP-BATCH-PARAM-TUNING-REGRESSION`**（已完成）：
    - 重新执行重复性回归。100张通过，但 200张 Round 1 依然在 cull part 4 发生 `DownloadInterrupted` 失败。特性开关已物理恢复为 `false`。
21. **`CORE-ZIP-EXPORT-ARCHITECTURE-PLANNING`**（当前阶段）：
    - 评估 200 张回归失败并定位为网页端导出架构物理瓶颈，该缺陷不影响双路相似组算法 Parity 的一致性结论（Parity 依旧多轮完美对齐）。但出于防范线上 OOM 与写入中断风险，**绝对禁止将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值设为 true，生产环境强制锁定为 false**，不进入 production true。网页端 200 张大尺寸 JPG ZIP 全量稳定导出不再作为当前浏览器原型的硬性完成目标，但在考虑 beta 之前，必须先完成清晰的 UX 限制提示、导出边界说明、失败引导和用户分批操作建议。在这些产品端的限制与引导未完成前，不应放宽 beta 准入判断。
