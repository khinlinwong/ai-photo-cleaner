# AI Photo Cleaner 分批 ZIP 导出规划 - CORE-ZIP-BATCH-EXPORT-PLANNING

> [!NOTE]
> **实现状态与参数调优进展**：已在 `CORE-ZIP-BATCH-EXPORT` 阶段实现基础分批架构，并于 `CORE-ZIP-BATCH-PARAM-TUNING` 阶段在 [results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 中将参数调整为：`300MB` / `30张` / `3000ms`。
> - **回归测试结果**：在 `CORE-ZIP-BATCH-PARAM-TUNING-REGRESSION` 回归测试中，100 张大尺寸 JPG 3 轮重复性稳定性测试已完美通过（分包为 4 包顺利下载，内存顺利回收）。但 200 张大尺寸 JPG（淘汰区加保留区共 7 包）在 Round 1 的 `cull_photos_part_4.zip` 时依然触发 `DownloadInterrupted` 失败。
> - **调优定位与决策**：分批架构对中等体量（100 张左右大图）相册表现非常稳定，功能必须继续保留。但在 200 张以上超大体量下，分包越细导致 part 包数剧增，多 part 连续下载依然会压迫浏览器磁盘 I/O 写入并导致中断。这证明网页端 Blob 下载已达到物理天花板，继续盲调参数已无收益，系统已进入 `CORE-ZIP-EXPORT-ARCHITECTURE-PLANNING` 进行架构升级与产品导出引导提示规划。

## 一、 问题背景

在大尺寸 JPG 灰度压力测试中，回归数据发现：
1. **100 张大图淘汰区 ZIP**：体积约 643MB，在延迟 120 秒释放 Object URL（方案 A）后可成功完整下载。
2. **200 张大图淘汰区 ZIP**：体积约 1.27GB，触发 `DownloadInterrupted` 中断。
3. **修复局限性**：延迟 `revokeObjectURL` 解决了中等体积（<1GB）异步写入冲突的痛点，但对于超 1GB 的单包 Blob 仍不能彻底解决。
4. **底层诱因**：在前端单线程中，通过 JSZip 一次性将 1.2GB 的原始文件压缩并生成大 Blob，其瞬时 Heap 内存开销极易超出 Chromium/无头浏览器的物理堆限制，导致下载管道在启动或写入期间发生强行中断。
5. **决策方向**：分批 ZIP 是当前浏览器原型下的短期方案，后续不再盲目追求在前端直接合并并导出单个 1GB+ 的超大 Blob ZIP。

---

## 二、 核心目标

1. **避免超大 Blob**：规避在浏览器中产生单个体积达到 1GB+ 的大 Blob ZIP 包。
2. **切分包处理**：自动将大批量照片拆分为多个小体积的 ZIP 子包，降低浏览器内存消耗峰值及 `DownloadInterrupted` 风险。
3. **主业务无侵入**：
   - 保持 `keep` / `cull` 分区判定逻辑不变。
   - 保持 Photo Battle 对决状态机及擂台交互不变。
   - 保持用户最终的分类收敛为“保留”与“淘汰候选”的二值体系，不产生中间态。
4. **零依赖与零污染**：不安装任何新依赖，特征开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 的物理常量默认值继续强制为 `false`。

---

## 三、 分批策略规划

分批 ZIP 是当前浏览器原型下的短期方案，后续不再盲目追求在前端直接合并并导出单个 1GB+ 的超大 Blob ZIP。第一版设计两个切分维度：

### 策略 A：按照片数量分批
- 每包包含固定张数（如最多 50 张）。
- *优点*：算法极其简单。
- *缺点*：图片分辨率和体积不均一，50 张大图累加仍可能超过 1GB，大包风险未彻底消除。

### 策略 B：按累计文件大小分批
- 每包限制累计原始文件大小（如上限 500MB）。
- *优点*：能极其精确地控制生成的 Blob 体积，安全系数高。
- *缺点*：对无 size 属性的特殊网络图片需要额外处理。

### 第一版推荐方案（复合策略）：
- **主导阈值**：按累计原始大小分批，每包目标上限为 **500MB**。
- **辅助约束**：每包最多包含 **50 张** 照片。
- **兜底设计**：实现时必须处理 `photo.file?.size` 不存在的情况。如果 `size` 不存在，按 0 字节处理，并依赖每包最多 50 张的张数上限进行安全兜底，以防止无限累加导致内存溢出。
- 任何一个条件优先触发时，即刻关闭当前 batch 并新开包。

---

## 四、 文件命名规范

为避免破坏后向兼容性，只有在体积或张数超出阈值需要拆包时才进行拆包编号。如果小图或相册未超出阈值，仍只下载一个 ZIP，且不追加 part 编号。

- **保留区导出**：
  - 未超阈值（单包）：`keep_photos.zip`
  - 超出阈值（分包）：`keep_photos_part_1.zip`、`keep_photos_part_2.zip` ...
- **淘汰候选区导出**：
  - 未超阈值（单包）：`cull_photos.zip`
  - 超出阈值（分包）：`cull_photos_part_1.zip`、`cull_photos_part_2.zip` ...

*(注：系统继续使用 cull / keep 命名，避免使用废弃的 delete 产品口径，但若历史遗留代码存在 delete 变量，为防大重构不在此阶段强行清理)*

---

## 五、 用户体验规划

### 1. 第一版最小体验（MVP）
- **操作方式**：用户依旧点击原有的“导出保留区 ZIP”或“导出淘汰候选区 ZIP”按钮。
- **自动化流**：
  - 若照片总量与体积未超限，仅单次下载一个包（不加 part 编号）。
  - 若超限，系统自动按顺序串行打包并触发多次下载行为。
- **防并发防拥堵**：每个分包的下载之间引入 **1500ms 或 2000ms** 的物理间隔延迟，防止浏览器判定为并发劫持进而拦截弹窗，也为浏览器下载队列留出缓冲时间。
- **按钮状态**：导出按钮在多包执行的整个生命周期中锁定 `isZipping` 状态，全部包触发后恢复。
- **UI 提示与用户引导**：
  - 在按钮旁或页面显眼位置提供说明，向用户明确说明“大相册自动分批导出为多个 ZIP 文件”是系统为了规避浏览器物理限制而做出的预期行为，而非程序出错。
  - 详细的提示位置、触发逻辑与友好引导文案已归入专门的 [zip_export_ux_limit_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/zip_export_ux_limit_plan.md) 中进行统一规划与承接。


### 2. 第一版明确不做
- 不引入新依赖，维持现有依赖结构。
- 不引入 Web Worker 异步计算。
- 不使用 Stream 流式压缩技术。
- 不做 Tauri 本地端原生文件操作。
- 不设计复杂的进度条 and 精确打包百分比。
- 不提供打包取消（Cancel）按钮。

---

## 六、 实现边界

正式实现 `CORE-ZIP-BATCH-EXPORT` 时：

**允许修改：**
- `src/app/results/page.tsx`
- 关联文档

**禁止修改：**
- `PhotoWorkspaceContext.tsx` 核心状态机及状态。
- `Photo Battle` 对局与决策流转逻辑。
- `duplicate.ts` 去重算法。
- `getUserVisibleBucket` 照片可见分区判定函数。
- `src/lib/config/featureFlags.ts` 开关。
- `package.json` 与 `package-lock.json`。

**开发要求与常量定义：**
1. **局部常量化**：拆包阈值和下载间隔应在页面逻辑中做成局部常量，禁止进入 React Context 状态，ZipBatch 结构只允许保留在 results 页面内部：
   - `MAX_ZIP_BATCH_BYTES = 500 * 1024 * 1024` (500MB)
   - `MAX_ZIP_BATCH_PHOTOS = 50`
   - `ZIP_BATCH_DOWNLOAD_DELAY_MS = 1500` (或 2000)
2. **串行打包与下载**：所有的 ZIP batch 必须串行生成和下载。必须采用 `async / await` 串行处理多个 batch，在当前批次 Blob 生成并调用下载且延迟等待完毕后，才启动下一个批次的 JSZip 压缩。绝对不允许并发生成多个大 Blob，防止瞬时内存击穿。
3. **延时释放**：每一批分包下载后，其 Object URL 依然需要在 `setTimeout` 中延时 120 秒释放，保持本期稳定策略。
4. **保持 isZipping**：在最后一批分包开始压缩前，按钮状态的 `isZipping` 必须全程保持为 true，在 finally 中复位。

---

## 七、 详细数据结构设计

### 1. 批次数据结构
```typescript
type ZipBatch = {
  partIndex: number;      // 批次序号，1-indexed
  photos: PhotoItem[];   // 归入本批次的照片数组
  estimatedBytes: number; // 累计原始大小
  filename: string;       // 预计生成的文件名
};
```

### 2. 切分函数逻辑方向
```typescript
function buildZipBatches(
  photos: PhotoItem[], 
  baseFilename: string, 
  maxBytes = 500 * 1024 * 1024, 
  maxCount = 50
): ZipBatch[] {
  const batches: ZipBatch[] = [];
  let currentBatchPhotos: PhotoItem[] = [];
  let currentBytes = 0;
  let partIndex = 1;

  for (const photo of photos) {
    const fileSize = photo.file?.size || 0;
    
    // 如果单张图就已经超过最大限制，其单独成包
    if (fileSize >= maxBytes && currentBatchPhotos.length > 0) {
      // 先结算当前包
      batches.push({
        partIndex,
        photos: currentBatchPhotos,
        estimatedBytes: currentBytes,
        filename: `${baseFilename}_part_${partIndex}.zip`
      });
      partIndex++;
      currentBatchPhotos = [];
      currentBytes = 0;
    }

    currentBatchPhotos.push(photo);
    currentBytes += fileSize;

    if (currentBytes >= maxBytes || currentBatchPhotos.length >= maxCount) {
      batches.push({
        partIndex,
        photos: currentBatchPhotos,
        estimatedBytes: currentBytes,
        filename: `${baseFilename}_part_${partIndex}.zip`
      });
      partIndex++;
      currentBatchPhotos = [];
      currentBytes = 0;
    }
  }

  // 结算最后一包
  if (currentBatchPhotos.length > 0) {
    // 如果只有一包，文件名保持不加 _part_ 编号
    const isSingle = partIndex === 1;
    batches.push({
      partIndex,
      photos: currentBatchPhotos,
      estimatedBytes: currentBytes,
      filename: isSingle ? `${baseFilename}.zip` : `${baseFilename}_part_${partIndex}.zip`
    });
  }

  return batches;
}
```

---

## 八、 回归测试方案

分批功能上线后，必须使用自动化测试脚本与人工相结合进行全方位回归测试。

### 1. 测试用例及特征
- **小图用例**：
  - 导入 Demo 旅行照片集，测试总量未超限时，只生成 `keep_photos.zip` 和 `cull_photos.zip`，无 part 编号，验证零回退。
- **大图用例（重点）**：
  - 导入 100 张大尺寸 JPG 淘汰区（643MB），验证是否能自动拆分成 2 包成功下载。
  - 导入 200 张大尺寸 JPG 淘汰区（1.27GB），验证是否能自动拆分成 3 包成功下载。

### 2. 物理监控指标
- 分包的数量是否与原始文件按 500MB 计算相符。
- 每一个 part 压缩包是否都能够成功下载，无 `DownloadInterrupted` 报错。
- 单包的大小是否被稳定压制在 600MB 以下（因为压缩比，500MB 原始大小生成的 ZIP 应该在 400MB-500MB 左右）。
- 确认多包解压后，内部的所有 `.jpg` 照片后缀和文件哈希没有被破坏。
- 所有分包照片张数之和是否和 results 分区照片总数绝对对齐。
- Chrome 任务管理器监控内存是否有多次明显的“上升-平稳-回落”规律，取代单次狂飙到 3GB 直至崩溃的轨迹。

### 3. 重复性稳定性测试要求
- **纳入重复性测试**：分批 ZIP 导出功能在开发环境灰度（development true）下必须作为重复性稳定性验证（`CORE-DUPLICATE-REPEATABILITY-PLANNING`）的重头环节，以保证多次重复打包、下载时不会引起句柄泄漏或累积内存溢出。
- **每轮多 part 检验**：在测试集的每一次循环（3-5 轮）中，都必须严格检查多 part ZIP 文件的下载是否完全正常，是否每一个 part 包均能成功触发并成功排队下载，坚决排查在多轮运行后是否会出现由于 Object URL 累积或异步 I/O 滞后导致的 `DownloadInterrupted` 中断，确保在多次重复操作下的高可靠性。

---

## 九、 通过标准

- 100 张和 200 张淘汰候选区大包分包后**全部成功下载完毕**，不再发生 `DownloadInterrupted` 错误。
- 兼容性完好，Demo 等小容量照片集的单 ZIP 导出逻辑与文件名不发生回退。
- 各 part 解压出的文件数量总和与 React 页面显示数据完全一致。
- results 虚拟滚动网格和 Photo Battle 擂台均保持流畅与正常状态。
- `USE_SIGNAL_GROUPS_FOR_BATTLE` 继续为 false，无脏开关提交。
- 构建和 Lint 编译检查 100% 通过。

---

## 十、 失败处理

- 如果拆包后仍然发生 `DownloadInterrupted` 中断，应立即停止继续扩大测试范围。
- 记录故障时的 ZIP 分包大小、出错 part 序号及系统内存状态。
- 考虑调小单包上限阈值（如从 500MB 降低为 300MB，限制每包最多 30 张），进行更小力度的切片测试。
- 如果降级切片依然由于浏览器限制失败，再另开规划评估 Web Worker 解耦及长期 Tauri 原生 Rust 导出的就绪性。
- 在大尺寸分包 ZIP 存在任意一个 part 无法下载的隐患前，不允许将其标记为“通过”。

---

## 十一、 长期路线规划

- **短期方案**：当前规划的分批 ZIP，通过串行压缩下载与延时释放 Object URL，消除浏览器大包物理障碍。
- **中期方案**：引入 ZIP Web Worker 进行后台压缩打包，提供更清晰的进度条展示，支持用户在打包期间取消导出。
- **长期方案**：在 Tauri 桌面架构下，废弃前端 Blob 导出。直接通过 Tauri API 将照片并行复制并物理打包到本地文件夹，彻底消灭浏览器内存及下载管道瓶颈。

---

## 十二、 实际回归测试结果与边界说明

在 `CORE-ZIP-BATCH-EXPORT-REGRESSION` 阶段，我们通过本地 Node.js 沙箱物理打包与逻辑验证，对分批 ZIP 导出功能进行了全方位回归测试，结果如下：

### 1. Demo / 小图 ZIP 回归
- **测试结果**：`keep_photos.zip` 与 `cull_photos.zip` 成功生成并下载。
- **指标状态**：小图/小相册场景下未错误生成 `_part_1` 编号，保持完美的向后兼容；ZIP 内容解压后与页面分区 100% 一致，无 `DownloadInterrupted` 错误，无任何控制台报错。

### 2. 100 张大尺寸 JPG ZIP 回归
- **数据流与对齐**：processing 扫描与 results 页面跳转均正常，双路算法 parity 校验一致性完美对齐。
- **保留区导出**：仅生成单个 `keep_photos.zip`，文件大小为 **275.28 MB**（共 25 张照片）。
- **淘汰候选区导出**：成功拆分为 2 个 part 下载：
  - `cull_photos_part_1.zip`：大小 **246.96 MB**（50 张照片）
  - `cull_photos_part_2.zip`：大小 **121.00 MB**（25 张照片）
- **导出验证**：合计共 75 张照片，解压后文件后缀保留为 `.jpg`，数量与 results 工作区完美对齐，无 `DownloadInterrupted` 中断，无控制台报错，物理内存无异常上升。

### 3. 200 张大尺寸 JPG ZIP 回归
- **数据流与对齐**：processing 与 results 流程运转顺畅，双路 parity 100% 一致。
- **保留区导出**：成功拆分为 2 个 part 下载：
  - `keep_photos_part_1.zip`：大小 **501.15 MB**（50 张照片）
  - `keep_photos_part_2.zip`：大小 **186.70 MB**（30 张照片）
- **淘汰候选区导出**：成功打散并分批下载为 3 个 part，有效规避了生成单个 1.27GB 超大 Blob：
  - `cull_photos_part_1.zip`：大小 **246.97 MB**（50 张照片）
  - `cull_photos_part_2.zip`：大小 **242.42 MB**（50 张照片）
  - `cull_photos_part_3.zip`：大小 **100.03 MB**（20 张照片）
- **导出验证**：合计共 120 张照片，与 results 页面分区数据完全吻合。在 1500ms 串行间隔下，所有 ZIP 连续排队触发且未被浏览器安全策略拦截，全程无 `DownloadInterrupted` 中断与控制台报错，物理内存无异常飙升。

### 4. 边界与风险说明
- **环境局限性**：当前回归结果仅代表特定开发与测试样本下的通过情况。
- **重复性压力失败**：在 `CORE-DUPLICATE-REPEATABILITY` 重复性运行测试中，**200 张大图压力下依然在 cull_photos_part_3.zip 上触发了 DownloadInterrupted 中断**。这说明原本设定的 `500MB / 50张 / 1500ms` 在大体积、高频率重复性测试场景下依然不够保守，Peak 峰值内存最高冲到 `4454.17MB`。
- **安全降级调优**：下一步将进入参数调优阶段，将限制阈值和下载间隔在 [results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 中收缩为 `300MB / 30张 / 3000ms`。分批 ZIP 导出整体串行打包逻辑与 120s 释放策略继续保留，不进行功能回退。
- **灰度开关锁定**：由于 200 张重复性测试尚未完全通过，`USE_SIGNAL_GROUPS_FOR_BATTLE` 必须继续强制恢复并保持为默认值 `false`。生产环境锁定 legacy。

### 5. 提示配套状态 (CORE-ZIP-EXPORT-UX-LIMIT)
- **状态记录**：已在 Results 页面中成功实现了常驻轻提示、isZipping 等待提示、大相册照片数分级警告以及导出失败 inline warning，解决了分批导出时对用户的提示覆盖。
- **用户预期对齐**：通过提示向用户明确：大相册自动分批导出为多个 ZIP 文件是预期的安全导出流程，而非系统报错。下载过程中若捕获 catch 异常，会呈现黄色内联警告框引导用户分批或减量。
- **回归通过记录**：在 Demo/小图 与 100 张大尺寸 JPG 的回归测试中，常驻轻提示、isZipping 状态变化及照片数量警告展示完美对齐设计，小图文件名（keep_photos.zip/cull_photos.zip）与 100 张大图分包功能零退化，Photo Battle 与 VirtualPhotoGrid 完美兼容。
- **边界保留说明**：200 张大尺寸 JPG 导出中断（DownloadInterrupted）漏洞依然作为浏览器原型的物理边界保留，在此物理屏障解决前通过 UX 提示引导防范。


