# AI Photo Cleaner 核心稳定化阶段快照 - CORE-STABILIZE-SNAPSHOT-PLANNING

## 一、 当前稳定状态

1. **最新远程 Commit**：`0146065 add batch zip export for large albums`。
2. **工作区状态**：`0146065` 提交后的代码基线干净，本轮仅有阶段快照相关文档变动。
3. **生产分流规则**：生产环境（production）继续强制锁定于 legacy 稳定路径运行，不进入 production true。
4. **开关默认值**：灰度开关常量 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值依然强力保持为 `false`。
5. **调试限制**：signal groups `true` 分支仍只允许在开发环境（development）下作为临时功能调试和压力测试，测试完毕即刻物理复位为 `false`。
6. **灾备防线**：继续完整保留旧有 legacy 的 `detectDuplicates` 与 `similarGroups` 主逻辑，作为核心安全防线，不予以移除。
7. **用户分类约束**：用户可见的最终决策分类强制且唯一地收敛为“保留 (keep)”与“淘汰候选 (cullCandidate)”两类，无第三最终分类。

---

## 二、 已完成关键成果

按核心模块与重构方向分类记录如下：

### 1. Duplicate / signal groups 算法
- **双路 parity 校验多轮通过**：在 Demo 旅行照片、200张仿真元数据、100/200/300张物理 BMP、混合格式 (JPG/PNG/WebP) 以及 mock 手机真实相册感照片的多轮压力测试下，新客观信号转换出的相似组与 legacy 结果 100% 对齐一致，Leader 错配数为 0。
- **稳定 QA Parity 指标输出**：已实现 development-only 隐式注入的 window 全局属性 `__AI_PHOTO_CLEANER_QA__`，用以代替原有的 React Fiber 内部树遍历和控制台输出正则解析，提高了自动化回归脚本校验的稳定性。
- **生产防护守卫拦截**：通过 production 物理构建验证，确认生产包环境下 `typeof window.__AI_PHOTO_CLEANER_QA__` 为 `undefined`，拦截且不暴露任何调试属性和信息，实现了优秀的防污染阻断。

### 2. Results UI 展示层性能
- **VirtualPhotoGrid 挂载成功**：已在 results 展示页面的保留区和淘汰候选区成功引入自研的泛型无状态虚拟滚动网格，控制了 DOM 树节点个数和内存驻留。
- **流畅度回归**：300 张大尺寸混合格式图片物理测试中，results 页面的滚动加载掉帧与内存暴涨得到显著改善，小图、100张、300张体量下的长列表拖拽浏览均能流畅响应，性能大幅提升。

### 3. ZIP 导出底座
- **延迟 revokeObjectURL 机制**：将 Blob 临时 Object URL 的释放改为在 `setTimeout` 中延迟 120 秒释放，成功解决了 100 张淘汰候选区（643MB）中等大小 ZIP 包在下载写入磁盘中途 URL 被同步 revoke 导致的中断错误。
- **分批 ZIP 导出机制**：彻底放弃前端直接压缩生成单个 1GB+ 浏览器 Blob 的高开销思路，实现局部限制 `MAX_ZIP_BATCH_BYTES = 500MB`，`MAX_ZIP_BATCH_PHOTOS = 50`，利用 `async/await` 串行排队生成和触发下载。
- **回归通过与重复性失败**：
  - **小包兼容（零回退）**：未超阈值的小相册直接导出单包，且文件名保持为 `keep_photos.zip` 与 `cull_photos.zip`，无 `_part_1` 编号。
  - **100 张大包通过**：100 张大尺寸 JPG（643MB）成功分包并在 3 轮重复性测试中顺利通过，无中断，内存可正常回收。
  - **200 张大包重复性失败（快照边界）**：200 张大尺寸 JPG 淘汰区（1.27GB）在第 1 轮分批导出 `cull_photos_part_3.zip` 时仍会触发 `DownloadInterrupted`。JSZip 主线程压缩时的 Peak 物理内存达到 `4454.17MB`。这确定了当前的快照边界：ZIP 分批基础框架已稳固建立，但 200 张大相册稳定性受制于参数宽松度，急需参数调优。

### 4. 安全与合规边界
- **测试图片沙箱化**：坚守隐私底线，大尺寸测试图片（约 200 张）全部物理保存在项目源码目录外的 D 盘，无任何测试 JPG 或临时 ZIP 被误提交进入 Git 历史。
- **HEIC / RAW 格式安全隔离**：对于移动端高占比的苹果 HEIC 以及单反 RAW 格式采取主动物理隔离，防止前端 analysis 出错。

---

## 三、 未完成与后续潜在风险

1. **多媒体格式覆盖未完成**：对于高占比的苹果 HEIC、相机 RAW 以及常见视频文件，当前扫描层依旧没有覆盖支持。
2. **缺乏真实客户相册长期测试**：当前所有测试集和 mock 真实感样本均为仿真逻辑生成的外部图片，没有在真实用户的复杂环境、巨型相册数据上进行过长期持久比对。
3. **分批参数不够保守**：500MB / 50张 / 1500ms 的分批参数在 200 张大图的高负荷重复性测试下依然被证实不够保守，会导致 ObjectURL 延迟释放叠加和 JSZip 物理内存峰值冲高，极易引发 `DownloadInterrupted` 下载中断，环境兼容性与长期可靠性面临考验。
4. **signal groups 严禁默认开启**：虽然逻辑 parity 已经对齐，但在通过更长周期的重复性和客户场景验证前，`USE_SIGNAL_GROUPS_FOR_BATTLE` 开关必须保持默认关闭，绝不能扩大至生产环境。
5. **正式 beta 前置依赖**：在进入真正的用户公开 beta 阶段前，仍然缺乏公开真实感大图样本的深度压测与重复性稳定性校验。
6. **快照稳定化边界**：当前快照的边界已定义为分批 ZIP 基础框架已建立且在 100 张大图下通过 3 轮重复测试，但 200 张大图的稳定性仍需调优。在 200 张大相册多轮重复性测试完全通过前，坚决不进入 beta 与 production 默认 true。

---

## 四、 规划下一阶段可选方向

### 方向 A：CORE-ZIP-BATCH-PARAM-TUNING-PLANNING（推荐下一步）
- **核心内容**：基于 200 张重复性测试暴露出的 `DownloadInterrupted` 故障，将分批限制参数收缩为更保守的配置：`MAX_ZIP_BATCH_BYTES = 300MB`，`MAX_ZIP_BATCH_PHOTOS = 30`，`ZIP_BATCH_DOWNLOAD_DELAY_MS = 3000ms`。
- **验证目的**：确认更低的文件阈值和更长的下载物理间隔可以大幅降低 Peak 物理内存、舒缓浏览器下载管道的 I/O 压力，最终攻克 200 张大图的多轮重复性下载障碍。
- **推荐理由**：这是解决当前 200 张物理稳定性缺失的唯一无副作用轻量级手段，不需要重构核心代码。

### 方向 B：CORE-REAL-PUBLIC-ALBUM-PLANNING
- **核心内容**：从 Unsplash / Pixabay 等渠道选用完全公开、无隐私问题的自然风景、公共建筑、室内物品等大图，编排成 100-300 张相似度极高的测试照片集。
- **验证目的**：提高相似聚类计算的熵值，进一步测试在极高相似度、极多重叠图片下的算法聚类表现和渲染稳定性。

### 方向 C：CORE-PRODUCT-UX-POLISH-PLANNING
- **核心内容**：微调 Results 页面的安全导出区域提示，在按钮旁展示分包 ZIP 的简明小字说明，防止用户误以为下载重复，不修改核心状态机和任何聚类算法。

---

## 五、 验收结论

- 当前核心稳定化阶段快照文档已根据最新测试结果进行更新。
- 0146065 提交后的代码基线干净，本轮仅有阶段快照及调优规划相关文档变动。
- **快照稳定快照边界**：分批 ZIP 导出在 100 张大图测试中全数通过；但 200 张大尺寸 JPG 仍然受制于浏览器 Blob 下载物理天花板，大包分包多时仍然会产生下载中断。快照边界更新为：分批 ZIP 框架已在 100 张通过，但 200 张大图稳定性仍需架构升级或产品限制引导。
- **测试实测记录**：在 `CORE-ZIP-BATCH-PARAM-TUNING-REGRESSION` 测试中，100 张大图 3 轮通过，但 200 张大图 Round 1 由于 Peak 内存达到 3931.92MB 在 `cull_photos_part_4.zip` 处再次触发 `DownloadInterrupted`，特性开关已物理恢复为 `false`。
- **下一阶段规划**：
  - `CORE-ZIP-EXPORT-ARCHITECTURE-PLANNING` 导出架构升级规划已成功完成并随 commit `87e2cb0` 提交。
  - 目前已正式进入 `CORE-ZIP-EXPORT-UX-LIMIT-PLANNING` 阶段，建立了专门的 [zip_export_ux_limit_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/zip_export_ux_limit_plan.md) 规划文档，明确了在 Results 页面中增加导出常驻轻提示、大图强提醒及失败引导的操作边界文案与 UI 设计规范。
  - **Beta 与灰度防线约束**：网页端 200 张大尺寸 JPG ZIP 全量稳定导出不再作为当前浏览器原型的硬性完成目标，但在考虑 beta 之前，必须先在 results 页面上完成清晰的 UX 限制提示、导出边界说明、失败引导和用户分批操作建议。在这些产品端的限制与引导未完成前，绝对不放宽 beta 准入判断。同时系统坚决不开启公开 beta 阶段，生产环境特征开关默认值锁死为 `false`，不移除 legacy 稳定底座。
