# AI Photo Cleaner ZIP 导出限制提示与失败引导规划 - CORE-ZIP-EXPORT-UX-LIMIT-PLANNING

## 一、 规划背景

在当前浏览器原型（Next.js）开发中，关于大相册导出性能及可靠性的验证表明：
1. **小图和中等压力可用**：小图、小体积相册的 ZIP 导出逻辑具备良好的向后兼容与稳定性。
2. **100 张大图通过**：100 张大尺寸 JPG 在 `300MB / 30 张 / 3000ms` 参数下通过 3 轮重复性稳定性测试。
3. **算法机制稳健**：200 张大尺寸 JPG 下，感知聚类算法、双路一致性校验（Parity 零错配）以及 Photo Battle 擂台赛状态机在多轮压测中表现极其稳健。
4. **大相册浏览器物理瓶颈**：200 张大尺寸 JPG 多 part ZIP 导出（淘汰区 + 保留区共计约 7 包）依然可能触发 `DownloadInterrupted` 导致下载中断。这属于浏览器主线程 Blob 内存叠加、磁盘 I/O 管道受限的固有边界，继续盲调参数已达到边际收益递减的死胡同。
5. **短期 UX 降级策略**：不再盲目追求在网页端单次无条件导出 200+ 张大尺寸物理相册，转而通过在 Results 页面增加清晰的用户提示、大图导出限制说明、失败容灾引导和分批操作建议，降低用户误用和挫败感。
6. **本轮只规划不实现**：本轮仅完成 UX 提示与文案规划，不修改任何 `src` 业务代码，不改变 feature flag，不启动公开 beta。

---

## 二、 规划 Results 页面提示位置

在 Results 页面中添加以下三类交互提示：

1. **导出按钮附近的常驻轻提示**：
   - 说明大相册会自动分批导出多个 ZIP。
   - 建议在导出期间不要刷新页面。
   - 建议等待浏览器提示全部 ZIP 下载完成。

2. **大图 / 大量文件导出前的强提醒**：
   - 若检测到照片数量较多或估算体积较大，在用户点击导出时，提示浏览器版导出可能需要较长时间。
   - 建议分批导出。
   - 不对超大相册提供一次性无限制导出承诺。

3. **导出失败后的友好引导**：
   - 拦截下载或生成异常，使用非技术语言告知用户。
   - 不显示诸如“系统崩溃”等恐慌词汇。
   - 建议减少单次选择并导出的图片数量。
   - 引导用户先导出“保留区”，再分批导出“淘汰候选区”。
   - 友情说明后续桌面版本会提供更稳定、无下载限制的原生导出能力。

---

## 三、 中英文文案规划

### 1. 中文文案

* **常驻提示**：
  > “大相册会自动分批导出为多个 ZIP 文件。导出期间请不要刷新页面，并等待所有文件下载完成。”
* **大图提醒**：
  > “当前相册文件较大，浏览器导出可能需要更长时间。若下载失败，建议减少单次导出数量或分批处理。”
* **失败提示**：
  > “ZIP 下载未完成。浏览器在处理超大相册时可能会中断下载。请尝试减少单次导出数量，或分批导出保留区和淘汰候选区。”
* **长期路线提示**：
  > “后续桌面版本会优化大相册本地导出能力，避免浏览器下载限制。”

### 2. 英文文案

* **常驻提示**：
  > “Large albums may be exported as multiple ZIP files. Please keep this page open until all downloads are complete.”
* **大图提醒**：
  > “This album is large, so browser-based export may take longer. If a download fails, try exporting fewer photos at a time.”
* **失败提示**：
  > “ZIP download was not completed. Browsers may interrupt very large exports. Please try exporting a smaller batch.”
* **长期路线提示**：
  > “A future desktop export flow will improve large-album local exports beyond browser download limits.”

---

## 四、 触发条件规划

根据导出图片的属性，动态决定呈现哪些提示信息（只做逻辑规划）：

1. **基于照片数量的触发**：
   - **超过 100 张**：显示常驻轻提醒。
   - **超过 200 张**：导出时显示强提醒。
2. **基于文件估算大小的触发**：
   - **超过 500MB**：显示常驻轻提醒。
   - **超过 1GB**：导出时显示强提醒。
3. **基于 ZIP 预计分包数量的触发**：
   - **预计 Part 数 > 1**：显示“将分批导出”状态。
   - **预计 Part 数 >= 4**：显示“大相册导出可能较慢，建议分次处理”。
4. **基于捕获异常的触发**：
   - 当 JSZip 生成或 ObjectURL 触发下载的 `try...catch` 捕捉到错误，或者浏览器由于句柄被 revoke 产生下载断点时，提示友好引导。

---

## 五、 UI 呈现方式规划

本着低侵入、高可靠的原则，限制未来实现的 UI 表现：

1. **导出按钮下方常驻**：直接在 results 页面保留区与淘汰候选区导出按钮下方，以小字（颜色柔和，如 `text-gray-500`）渲染常驻轻提示。
2. **导出状态中（isZipping）**：导出执行时，将按钮文本或其旁边的 loading 状态动态展示为：“正在生成 ZIP，请等待所有分包下载完成...”。
3. **轻量 confirm 弹窗**：在用户触发超大导出（照片数 > 200 或估计大小 > 1GB）时，通过轻量级确认框（Confirm / Inline Warning Banner）提供强提醒，用户确认后方可继续。
4. **页面内 Warning 提示框**：若发生下载中断或捕获异常，在 Results 页面中渲染一个显眼的黄色警告框（现有项目警告框样式，不引入 Toast 等外部繁琐 UI 依赖），向用户显示友好失败提示。
5. **不引入任何外部 UI 库**，不改变按钮和列表的主体排版结构。

---

## 六、 未来实现边界

在进入 `CORE-ZIP-EXPORT-UX-LIMIT` 实现阶段时，应严格坚守以下红线：

### 允许修改：
- `src/app/results/page.tsx`
- 关联规划与验证文档

### 绝对禁止修改：
- `PhotoWorkspaceContext.tsx` 核心状态机及比对队列管理。
- `Photo Battle` 对决逻辑及擂台界面状态流转。
- `duplicate.ts` 去重及客观分析算法。
- `getUserVisibleBucket` 照片可见分类划分规则。
- `src/lib/config/featureFlags.ts` 开关。
- `package.json` 与 `package-lock.json`（不引入新依赖）。

### 绝对禁止引入：
- 禁止引入 Worker 异步解耦打包。
- 禁止引入流式 ZIP 或 `File System Access API`。
- 禁止引入 Tauri 桌面原生文件操作。
- 禁止修改生产环境的特征开关默认值，`USE_SIGNAL_GROUPS_FOR_BATTLE` 必须继续在物理上锁死为 `false`，不开启 Beta，不移除 legacy 稳定底座。

---

## 七、 未来验收标准

1. **小图体验零回退**：导入少于 100 张的小相册，导出流程一气呵成，无任何错误弹窗，体验流畅。
2. **大图强提示可见**：导入 100 张/ 200 张大尺寸 JPG，在 results 页面能清晰看到分批提示。
3. **分批等待有指示**：在 isZipping 打包串行流期间，按钮有明确的等待下载引导，且 isZipping 锁死直到最后一个包触发完毕。
4. **失败引导易读**：模拟或真实发生下载中断时，能优雅弹出页面内警告引导。
5. **对齐核心与 Parity**：前述 UI 提示的添加完全不侵入 Photo Battle、算法 Parity 双路校验以及 properties 传递。
6. **不引入新依赖**：项目依赖树保持纯净。
7. **USE_SIGNAL_GROUPS_FOR_BATTLE 保持 false**。

---

## 八、 实施记录与回归测试报告 - CORE-ZIP-EXPORT-UX-LIMIT
- **实现状态**：已在 results 页面中成功实现最小 inline warning 与引导提示，并顺利通过了回归测试。
- **本轮实现范围**：
  - **常驻导出提示**：在结果页面导出区域下方常驻显示大相册分批导出、请勿刷新、等待下载完成的轻提示。
  - **isZipping 等待提示**：在 isZipping 为 true 期间，在结果页中显示正在生成 ZIP 并等待分包下载完成的动态提示。
  - **ZIP catch 失败提示**：在 `downloadPhotosZip` 过程的 catch 块中，捕获异常并设置友好失败状态，在 UI 中以黄色警告边框形式进行页面内警告展示。文案统一使用“淘汰候选”而非“删除”。在下一次导出开始时，会自动清空旧有状态。
  - **照片数量提示**：已基于 `photos.length` 完成大相册提示。当照片数 > 100 时显示轻提示，> 200 时显示强提示，提醒用户可能导出时间较长或建议分批导出。
- **回归测试结论**：
  - **Demo / 小图回归通过**：在导入小图片或 Demo 旅行相册时，/desktop、/processing 与 /results 页面交互均完全正常。页面正确渲染了常驻轻提示与 isZipping 状态提示；小图未错误显示 100/200张 的警告；导出 `keep_photos.zip` 与 `cull_photos.zip` 正常完成且文件名与分包逻辑未发生任何退化，未发生 `DownloadInterrupted` 中断。Photo Battle 与虚拟滚动网格均不受影响。
  - **100 张大尺寸 JPG 回归通过**：在 100 张大图压力下，results 页面能够正确显示 > 100张 的轻提示，且未错误显示 > 200张 的强提示。常驻提示与 isZipping 提示功能完备，分批打包导出正常（淘汰区自动分拆为 4 包，合计照片数与 UI 分区完全一致，保留 `.jpg` 后缀），未触发任何 `DownloadInterrupted` 错误，控制台无报错。
  - **小屏 / 窄宽度布局通过**：在较窄视口宽度下进行布局审计，提示文本自适应换行良好，无多余溢出；警告框和 states 提示在垂直卡片下仅会自适应流式推开，不撑坏页面布局且不遮挡按钮；Photo Battle 弹窗和 VirtualPhotoGrid 列表滚动正常自适应，不发生遮挡与卡顿。
  - **失败 warning 审查通过**：本轮为了保障主打包逻辑的物理纯净，未强行修改代码制造失败场景；通过对 catch 块以及 React state 的代码静态审查，确认异常发生时能准确展示警告内容，且在下一次点击时会被 `setZipExportWarning(null)` 妥善清空。
  - **200 张大尺寸 JPG 隔离**：本轮为了专注于验证 UX 提示的无回退和 UI 兼容，未进行 200 张大图的重复性压力测试。
- **确认未做事项（红线坚守）**：
  - 没有引入复杂的外部弹窗系统或第三方 Toast 库，项目依赖树保持纯净。
  - 没有修改 ZIP 分区筛选逻辑，没有修改 `buildZipBatches` 与 `downloadPhotosZip` 的核心分包与下载调度流程。
  - 没有修改 Context、Photo Battle 及相似检测 `duplicate` 核心算法与分区划归规则，最终的分类强收敛于二值分类。
  - 没有引入 Web Worker 异步打包、流式 ZIP 或 Tauri 等大规模物理重构。
  - 特性开关 `USE_SIGNAL_GROUPS_FOR_BATTLE` 继续保持为默认 `false`，生产环境绝对走 legacy 稳定底座。


