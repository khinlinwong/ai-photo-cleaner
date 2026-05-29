# AI Photo Cleaner 核心稳定化阶段快照 - CORE-STABILIZE-SNAPSHOT-PLANNING

## 一、 当前稳定状态

1. **最新远程 Commit**：`3b6f173 document core stabilization next steps`。
2. **工作区状态**：`3b6f173` 提交后已记录核心稳定化下一阶段演进路线。当前已进入 Results 页面 UI Polish 规划阶段（`CORE-RESULTS-UX-POLISH-PLANNING`），设计并统一了展示层词汇与交互限制。
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
  - **200 张大包重复性失败（快照边界）**：200 张大尺寸 JPG 淘汰区（1.27GB）在分批导出时仍会触发 `DownloadInterrupted`。虽然调优了参数（300MB/30张/3000ms）将 Peak 内存降至 3931.92MB，但由于分包多且连续写入，依然无法完全规避浏览器 I/O 管道超载。这确立了快照边界：网页端 Blob 导出在此体量下已达物理天花板，转向 UX 限制提示与中长期架构规划，不再继续盲目参数调优。

### 4. 安全与合规边界
- **测试图片沙箱化**：坚守隐私底线，大尺寸测试图片（约 200 张）全部物理保存在项目源码目录外的 D 盘，无任何测试 JPG 或临时 ZIP 被误提交进入 Git 历史。
- **HEIC / RAW 格式安全隔离**：对于移动端高占比的苹果 HEIC 以及单反 RAW 格式采取主动物理隔离，防止前端 analysis 出错。

---

## 三、 未完成与后续潜在风险

1. **多媒体格式覆盖未完成**：对于高占比的苹果 HEIC、相机 RAW 以及常见视频文件，当前扫描层依旧没有覆盖支持。
2. **缺乏真实客户相册长期测试**：当前所有测试集和 mock 真实感样本均为仿真逻辑生成的外部图片，没有在真实用户的复杂环境、巨型相册数据上进行过长期持久比对。
3. **分批参数调优已验证边际收益递减**：虽然 300MB / 30 张 / 3000ms 常量调优降低了内存峰值并通过了 100 张大尺寸 JPG 的多轮重复回归，但在 200 张大尺寸 JPG 等极高压大相册场景下，依然会由于分包变多、连续排队下载写盘触及浏览器 Blob / JSZip 物理天花板而导致 `DownloadInterrupted` 中断。下一阶段不再盲目收窄参数，而是转向 UX 提示引导防范。
4. **signal groups 严禁默认开启**：虽然逻辑 parity 已经对齐，但在通过更长周期的重复性和客户场景验证前，`USE_SIGNAL_GROUPS_FOR_BATTLE` 开关必须保持默认关闭，绝不能扩大至生产环境。
5. **正式 beta 前置依赖**：在进入真正的用户公开 beta 阶段前，仍然缺乏公开真实感大图样本的深度压测与重复性稳定性校验。
6. **快照稳定化边界**：当前快照的边界已定义为分批 ZIP 基础框架已建立且在 100 张大图下通过 3 轮重复测试，但 200 张大图多包连续下载触发中断已属于浏览器原型的物理天花板。在 results 页面上物理完成清晰的容量限制提示、失败引导与分批导出等 UX 改造前，绝对不放宽 beta 准入判断，坚决不开启公开 beta 且生产环境保持 false。

---

## 四、 规划下一阶段可选方向

### 方向 A：CORE-ZIP-BATCH-PARAM-TUNING-PLANNING 与回归验证（已完成）
- **核心内容**：基于 200 张重复性测试暴露出的 `DownloadInterrupted` 故障，将分批限制参数收缩为更保守的配置：`MAX_ZIP_BATCH_BYTES = 300MB`，`MAX_ZIP_BATCH_PHOTOS = 30`，`ZIP_BATCH_DOWNLOAD_DELAY_MS = 3000ms`。
- **验证结论**：调优后 100 张大图 3 轮重复性回归成功通过，但 200 张大尺寸 JPG 仍会触发 DownloadInterrupted，证明微调分批参数边际收益递减，网页端已达物理天花板。不再盲目调参，已推进 Results UX 限制提示与失败引导，并推荐进入结果页 UI Polish 阶段。


### 方向 B：CORE-REAL-PUBLIC-ALBUM-PLANNING
- **核心内容**：从 Unsplash / Pixabay 等渠道选用完全公开、无隐私问题的自然风景、公共建筑、室内物品等大图，编排成 100-300 张相似度极高的测试照片集。
- **验证目的**：提高相似聚类计算的熵值，进一步测试在极高相似度、极多重叠图片下的算法聚类表现和渲染稳定性。

### 方向 C：CORE-PRODUCT-UX-POLISH-PLANNING
- **核心内容**：微调 Results 页面的安全导出区域提示，在按钮旁展示分包 ZIP 的简明小字说明，防止用户误以为下载重复，不修改核心状态机和任何聚类算法。

---

## 五、 验收结论

- 当前核心稳定化阶段快照文档已根据最新测试结果进行更新。
- `7619084` 提交后已在 results 页面完成轻量级导出提示与失败 warning。
- **快照稳定快照边界**：分批 ZIP 导出在 100 张大图测试中全数通过；但 200 张大尺寸 JPG 仍然受制于浏览器 Blob 下载物理天花板，大包分包多时仍然会产生下载中断。快照边界更新为：分批 ZIP 框架已在 100 张通过，但 200 张大图稳定性仍需架构升级或产品限制引导。
- **测试实测记录**：在 `CORE-ZIP-BATCH-PARAM-TUNING-REGRESSION` 测试中，100 张大图 3 轮通过，但 200 张大图 Round 1 由于 Peak 内存达到 3931.92MB 在 `cull_photos_part_4.zip` 处再次触发 `DownloadInterrupted`，特性开关已物理恢复为 `false`。
- **下一阶段规划**：
  - `CORE-STABILIZE-NEXT-STEPS-PLANNING` 核心稳定化下一阶段路线规划已成功完成，并随 commit `3b6f173` 提交。
  - 目前已正式进入 `CORE-RESULTS-UX-POLISH-PLANNING` 规划阶段，建立了专门的 [results_ux_polish_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/results_ux_polish_plan.md) 规划文档，设计对 Results 展示层细节体验进行微调。
  - **下一步路线推荐**：在通过本轮规划（CORE-RESULTS-UX-POLISH-PLANNING）和后续审查（CORE-RESULTS-UX-POLISH-QA）后，建议进入具体实现阶段。
  - **Beta 与灰度防线约束**：系统暂缓开启公开 Beta，特性开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值继续锁死为 `false`，生产环境锁定 legacy 稳定底座，不予以移除。
