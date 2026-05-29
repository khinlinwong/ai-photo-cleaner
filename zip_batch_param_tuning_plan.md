# AI Photo Cleaner 分批 ZIP 参数调优规划 - CORE-ZIP-BATCH-PARAM-TUNING-PLANNING

## 一、 失败背景记录

在 `CORE-DUPLICATE-REPEATABILITY` 测试中：

### 100 张大尺寸 JPG
* **测试结论**：连续 3 轮全部通过。
* **Parity 校验**：完全对齐（oldSimilarGroupCount=4, newSimilarGroupCount=4，无错配，leaderMismatchCount=0）。
* **擂台赛 (Photo Battle)**：各项模拟操作及 Esc 关闭对局功能均完全正常。
* **分批 ZIP 导出**：正常导出 cull 淘汰区 2 个 part ZIP 文件并成功被拦截下载。
* **下载中断**：无任何 DownloadInterrupted 报错。
* **内存特征**：未发现明确的阶梯式上涨（Round 1-3 回收后内存正常稳定在 1.49GB - 2.87GB 之间）。

### 200 张大尺寸 JPG
* **测试结论**：第 1 轮测试失败。
* **核心现象**：
  - Processing 耗时 58.01s，图像分析正常完毕。
  - Parity 校验完全对齐，`leaderMismatchCount = 0`。
  - 擂台赛各项交互模拟均正常。
  - 分区 ZIP 导出中，`keep_photos.zip`、`cull_photos_part_1.zip` 及 `cull_photos_part_2.zip` 成功下载。
  - 第三包 `cull_photos_part_3.zip` 连续打包下载过程中出现 `DownloadInterrupted` 导致测试强制中止。
  - 测试期间 Peak 物理内存达到 `4454.17MB`。
* **保护与回退**：测试按规程立即中止，未执行第 2 和第 3 轮，并且开发环境特性开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认值 `false`。

---

## 二、 失败原因分析与判断

本次测试失败**不指向**以下业务与算法功能错误：
1. `duplicate` / `analysis` 双路核心算法错误（Parity 比对完全吻合）。
2. Parity 校验与指标匹配机制错误。
3. Photo Battle 擂台赛状态机逻辑错误。
4. `getUserVisibleBucket` 照片保留/淘汰筛选分区错误。
5. 生产环境防护守卫拦截错误（特性开关正常回退，无生产代码污染）。

本次失败**更可能指向**以下性能与下载管道瓶颈：
1. **单包参数偏高**：原本设定的限制为 `MAX_ZIP_BATCH_BYTES = 500MB`，在 100 张大图的样本下虽安全，但面对 200 张大图持续打包时单包体积过高，极易引发 Chromium / QtWebEngine 内存缓冲区载入过载。
2. **短期内存叠加**：目前设定的 `120秒 ObjectURL 延迟释放机制`（用以保障下载）导致在生成多包时，多包的内存 Blob 在生命周期内发生物理堆积。
3. **下载管道压力**：原定 `ZIP_BATCH_DOWNLOAD_DELAY_MS = 1500ms` 的下载间隔对于超大 Blob 的持续传输显得偏短，浏览器下载管道在尚未完全释放前一包的写入句柄时又收到下一大包的下载指令，导致网络栈线程冲突。
4. **JSZip 单线程峰值**：JSZip 在主线程上同步或长时间连续压制多包 500MB 级别文件，短时间内内存吞吐极大（测试 Peak 物理内存冲高至 4.45GB），导致 JS 引擎主线程无响应。
5. **下载管道崩溃**：Chromium / QtWebEngine 下载管道在连续接受超大尺寸 Blob URL 时发生不稳定性，直接抛出 `DownloadInterrupted` 异常中断。

---

## 三、 参数调优目标

为攻克 200 张超大相册连续下载中的 DownloadInterrupted 报错，本调优方案设定以下目标：
1. **降低单包体积**：降低单个 part 的 Blob 物理字节数。
2. **降低内存叠加**：减少短时间内 JSZip 打包并存的大尺寸 Blob 数量。
3. **优化 JSZip 单线程负载**：将一次性打包的大图张数降下来，降低主线程 CPU 持续占满时长。
4. **给浏览器下载管道腾挪时间**：拉长多 part 触发下载的间隔时间。
5. **保持不改变核心逻辑**：在不重写 ZIP 导出方案、不引入 Web Worker、不引入流式 ZIP/Tauri 及不安装任何新依赖的前提下，单纯依赖轻量参数调整达成目标，保持方案的简洁可维护性。

---

## 四、 规划参数修改方向

我们规划将 [results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 中的局部常量修改为更保守的参数配置：

| 参数项 | 原参数值 | 调优规划值 | 规划考量与设计理由 |
| :--- | :--- | :--- | :--- |
| `MAX_ZIP_BATCH_BYTES` | `500 * 1024 * 1024` (500MB) | `300 * 1024 * 1024` (300MB) | 降低单包 Blob 体积上限至 300MB，大幅减少底层传输缓冲区开销与 JSZip 打包时的临时对象大小。 |
| `MAX_ZIP_BATCH_PHOTOS` | `50` 张 | `30` 张 | 限制单包照片为 30 张，对大尺寸照片进行更早的分批，减轻 JSZip 连续大包生成的堆积开销。 |
| `ZIP_BATCH_DOWNLOAD_DELAY_MS` | `1500` ms (1.5秒) | `3000` ms (3.0秒) | 将各 part 下载触发间隔拉长至 3.0 秒，让浏览器有更宽裕的时间完成磁盘 I/O 写入并稳定前一包的 ObjectURL 释放。 |
| `ZIP_OBJECT_URL_REVOKE_DELAY_MS` | `120_000` ms (120秒) | `120_000` ms (120秒) | 暂时保持 120 秒延迟释放以保证中等包在延迟下载时可用，主要防范释放过早中断大包。 |

> [!NOTE]
> **关键验证声明**：`300MB / 30 张 / 3000ms` 是下一轮参数调优的验证参数，并不属于最终的通过保证。在参数调优成功且通过 200 张大尺寸 JPG 循环重复性测试前，不能认定 200 张重复性测试已经通过。
> 如果将参数调整为 300MB / 30 张 / 3000ms 后重复性测试仍出现 DownloadInterrupted，我们将进行下一轮备用调优：进一步将参数压实至 200MB / 20 张 / 5000ms，或者在更高架构层面探讨引入 Web Worker 异步解耦、流式 ZIP 导出（ReadableStream）以及 Tauri / native export 原生写入方案。当前在 core stabilization 阶段应首选无副作用的轻量参数配置。

---

## 五、 规划预期影响

### 预期优点
* **大幅减轻内存峰值**：JSZip 打包的临时内存吞吐和单包 Blob 体积收缩 40% 左右，有效避免 Peak 物理内存冲破 4GB 引发进程过载。
* **显著降低 DownloadInterrupted 概率**：3.0 秒的下载间隔让 QtWebEngine 的下载管道拥有充足的缓冲期，可有效改善高频多大包并发下的底层句柄崩溃问题。
* **提高 200 张大图测试通过率**：通过分批参数保守化，为超大相册样本测试打下安全基石。

### 引入代价
* **生成更多 part 压缩文件**：大尺寸相册会被打散为更多 part 下载包（例如 200 张大图的 cull 分区，原先是 3 包，调优后会分成 4-5 包）。
* **下载触发更慢**：多包连续弹出下载的总耗时延长（3秒/包），用户需要等待更长时间才能完全下载完毕。
* **多包拦截拦截性**：多包并发在更小参数下，虽然提高了单包安全性，但在面对包数量增多时，可能需要更加严格地验证 Chromium 对高频多包触发的自动拦截行为。

---

## 六、 规划实现边界与红线

在 `CORE-ZIP-BATCH-PARAM-TUNING` 实际执行时，必须严格遵守以下开发边界：

### 允许修改范围
* **只允许修改** [results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 中的以下三大分批 ZIP 局部常量：
  - `MAX_ZIP_BATCH_BYTES`
  - `MAX_ZIP_BATCH_PHOTOS`
  - `ZIP_BATCH_DOWNLOAD_DELAY_MS`
* 更新相关说明文档。

### 禁止修改与操作红线
* **绝对禁止修改**：
  - 禁止修改 `Context` 状态管理及双路比对机制。
  - 禁止修改擂台赛（Photo Battle）对局与决策流转逻辑、界面组件。
  - 禁止修改 `duplicate / analysis` 聚类算法。
  - 禁止修改 `getUserVisibleBucket` 分区归纳规则与 ZIP 分区筛选逻辑。
  - 禁止修改 JSZip 整体封装形式与打包导出架构。
  - 禁止修改特性开关 `src/lib/config/featureFlags.ts`（测试时仅在开发环境临时 true，最终必须恢复 false）。
  - 禁止修改 `package.json` 与 `package-lock.json`。
* **绝对禁止引入**：
  - 禁止安装任何新依赖。
  - 禁止引入 Web Worker 线程方案。
  - 禁止引入流式打包（ReadableStream）。
  - 禁止引入 Tauri 宿主端文件流写入方案。
  - 禁止篡改或影响用户的最终“保留 / 淘汰候选”二值分类数据。

---

## 七、 规划回归测试与通过标准

### 第一阶段：100 张大尺寸 JPG 连续 3 轮回归
1. 校验更低的 300MB/30张 批次限制没有导致小图/中图单包场景（小于 300MB 且小于 30 张）产生不必要的分包退化。
2. 确认 100 张下的分包数量符合算法分区预期。
3. 确认无任何 DownloadInterrupted 报错。
4. 确认 120s 后的内存正常平稳回落至基线。

### 第二阶段：200 张大尺寸 JPG 连续 3 轮回归
1. 只有 100 张回归通过后才允许执行。
2. 重点对 `cull_photos_part_3.zip` 及之后的更多 part 分包进行物理下载成功率验证。
3. 详细记录每轮测试中：part 数量、每包物理字节数、每包包含文件数。
4. 严格记录并对比调优后的 Peak 峰值内存（期望远低于 4GB）。
5. 验证每轮结束后 120 秒，内存能够回落至合理水位。
6. 不允许出现任何一包下载中断。

---

## 八、 规划中止与通过标准

### 整体通过标准
1. **多轮完美通过**：100张 Tier 三轮通过，且 200张 Tier 三轮亦必须全部完美通过。
2. **Parity 校验对齐**：每轮比对算法的分组与照片指标零偏差。
3. **零错配**：`leaderMismatchCount = 0`。
4. **功能闭环**：擂台赛和 ZIP 导出在连续测试中交互表现完美。
5. **分批精确无误**：所有 part 包解压后的合计总照片数与页面保留/淘汰区的物理数字精确吻合。
6. **文件完备性**：ZIP 包解压后完全保留 JPG 后缀且可正常浏览，无 DownloadInterrupted。
7. **无内存泄露**：每轮结束后 120 秒，物理内存恢复平稳，不产生阶梯型持续冲高。
8. **工作区整洁**：特性开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 恢复 `false`，Git 无临时文件污染。

### 中止条件
若测试中发生以下任意情况，必须立即强行终止测试，回退特性开关为 `false`，进入 `CORE-ZIP-BATCH-PARAM-TUNING-FAIL-READ` 记录细节并暂缓开发：
1. 双路 Parity 出现比对错配。
2. 擂台赛模拟过程中发生交互死锁或白屏。
3. 即使参数收缩后，多包下载中依然在任何一包上触发了 `DownloadInterrupted`。
4. 导出 part 包内存在文件丢失或合计总照片数与 UI 分区不一致。
5. 进程发生 OOM 崩溃或 Peak 内存依然异常突破 4.2GB。
6. 120秒延迟释放结束后，多轮之间的内存产生累加式台阶状上涨。
7. 特性开关无法物理复原，或测试 ZIP 图片残留在项目内污染了 Git。

---

## 九、 beta / production true 阻塞限制记录
* **Beta 准入硬阻塞**：200 张大尺寸 JPG 循环重复性测试全部安全通过是灰度与稳定性验证的关键指标。在 200 张多轮测试完美通过前，**强行不准进入 Beta 阶段**。
* **Production 默认开启硬阻塞**：为了防止线上普通用户面临超大 Blob 打包引起的浏览器崩溃与中断风险，在参数调优验证前，**禁止将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值设为 true**，生产环境继续保持 legacy 强制策略，开发环境仅允许临时设置为 true 以供回归测试。
