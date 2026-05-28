# AI Photo Cleaner 大尺寸 JPG 灰度测试规划 - CORE-DUPLICATE-LARGE-JPG-PLANNING

## 一、测试目标
本轮目标不是扩大到 500+，而是验证大尺寸 JPG 对浏览器原型的物理压力。

目标：
1. 规划 100 / 200 张 3MB-10MB JPG 非隐私测试。
2. 验证大图文件读取和解码是否可接受。
3. 验证 Canvas 像素分析是否造成明显主线程卡顿。
4. 验证 results 虚拟网格是否仍能正常显示和滚动。
5. 验证 Photo Battle 是否仍正常。
6. 验证 ZIP 导出是否仍正常。
7. 验证 `window.__AI_PHOTO_CLEANER_QA__` 是否仍能稳定读取 parity。
8. 测试结束必须恢复 `USE_SIGNAL_GROUPS_FOR_BATTLE=false`。

## 二、测试图片来源规划
### 允许来源
1. 非隐私、非敏感的大尺寸 JPG 测试图片。
2. 无人物、无车牌、无家庭信息的风景、建筑、物品图。
3. 可公开使用的测试图片。
4. 自行生成或压缩放大的模拟大尺寸 JPG。

### 禁止来源
1. 客户照片。
2. 家庭私人照片。
3. 清晰人脸。
4. 车牌、证件、地址、账单。
5. 聊天截图、银行截图、护照、签证材料。
6. 任何敏感或无法公开内容。
7. 任何放入项目目录的图片。

## 三、测试集组成规划
### 第一档 100 张
- **格式**：JPG
- **数量**：100 张
- **单张大小**：3MB - 10MB
- **总大小目标**：300MB - 1GB
- **图像内容建议**：
  - 30 张风景 / 建筑。
  - 20 张物品 / 室内静物。
  - 20 张相似构图 / 轻微位移。
  - 15 张曝光异常。
  - 15 张轻微模糊或压缩损伤。

### 第二档 200 张
- **格式**：JPG
- **数量**：200 张
- **单张大小**：3MB - 10MB
- **总大小目标**：600MB - 2GB
- **执行条件与限制**：
  - **200 张不是必跑档位**。
  - 只有 100 张测试通过且没有明显卡顿、无响应、内存异常、ZIP 失败时才执行。
  - 如果 100 张已经暴露明显主线程压力，应停止 200 张测试。
  - 不能为了完成测试而强行继续。

### 暂不包含
- HEIC
- RAW
- PNG / WebP
- 视频
- GIF 动图

## 四、测试目录规划
测试目录必须在项目外，例如：
`D:\ai-photo-cleaner-large-jpg-test`

### 要求
1. 测试图片不得复制进项目目录。
2. 测试图片不得被 Git 追踪。
3. 测试完成后可删除或保留在项目外。
4. `git status` 不得显示任何图片文件。
5. 下载或生成图片时必须确认目录不是项目子目录。

## 五、测试步骤规划
未来测试时执行：
1. 确认 `git status` 干净。
2. 确认 `USE_SIGNAL_GROUPS_FOR_BATTLE=false`。
3. 确认测试图片在项目外。
4. 临时改为 `USE_SIGNAL_GROUPS_FOR_BATTLE=true`。
5. 启动 `npm run dev`。
6. 打开 `/desktop`。
7. 导入 100 张 3MB-10MB JPG。
8. 完成 `/processing`。
9. 进入 `/results`。
10. 读取 `window.__AI_PHOTO_CLEANER_QA__`。
11. 记录 parity 指标。
12. 测试 Photo Battle。
13. 测试 ZIP。
14. 测试 results 滚动。
15. 记录浏览器是否无响应。
16. 如可行，观察浏览器内存占用。
17. 100 张通过后才执行 200 张。
18. 测试结束恢复 `USE_SIGNAL_GROUPS_FOR_BATTLE=false`。
19. 运行 `git diff -- src/lib/config/featureFlags.ts`，必须为空。
20. 运行 `npm run build` / `npm run lint`。
21. 确认 `git status` 无图片、无 zip、无日志。

## 六、记录指标规划
每个档位记录：
### 基础指标
- 图片数量。
- 单张大小范围。
- 总文件大小。
- `/processing` 耗时。
- `/results` 是否正常。
- results 滚动是否正常。
- 是否白屏。
- 是否浏览器无响应。
- 是否控制台报错。
- 如可行，记录 Chrome 任务管理器内存峰值。

### QA parity 指标
- `oldSimilarGroupCount`
- `newSimilarGroupCount`
- `similarGroupCountMismatch`
- `oldSimilarGroupedPhotoCount`
- `newSimilarGroupedPhotoCount`
- `similarGroupedPhotoCountMismatch`
- `leaderMismatchCount`
- `generatedAt` 是否存在。
- `source` 是否为 `duplicateGroupQA`。
- 是否只包含安全字段。

### 业务指标
- Photo Battle 是否自动触发。
- 保留左边是否正常。
- 保留右边是否正常。
- 两张都保留是否正常。
- 两张都标记为淘汰候选是否正常。
- 跳过是否正常。
- reset 是否正常。
- ZIP 导出是否正常。
- ZIP 导出耗时。
- ZIP 是否和页面分区一致。
- 是否出现第三最终分类。

## 七、通过标准规划
1. `oldSimilarGroupCount === newSimilarGroupCount`
2. `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`
3. `similarGroupCountMismatch === false`
4. `similarGroupedPhotoCountMismatch === false`
5. `leaderMismatchCount === 0`
6. Photo Battle 正常。
7. ZIP 正常。
8. results 页面滚动可接受。
9. 无浏览器无响应。
10. 无第三最终分类。
11. 测试结束恢复 false。
12. `git status` 没有测试图片。
13. `featureFlags.ts` 无 true 残留。

## 八、中止条件规划
如出现以下情况，应停止后续档位：
1. 100 张阶段浏览器无响应。
2. 100 张阶段 processing 时间过长且页面无法交互。
3. 内存持续上升导致浏览器崩溃。
4. Canvas 解码失败。
5. ZIP 导出失败。
6. group count mismatch。
7. grouped photo count mismatch。
8. `leaderMismatchCount > 0`。
9. Photo Battle 死锁。
10. 出现第三最终分类。
11. 测试图片进入 Git。
12. feature flag 无法恢复 false。

### 失败后处理
- 不要修复代码。
- 先恢复 `USE_SIGNAL_GROUPS_FOR_BATTLE=false`。
- 记录失败档位、图片规模、文件大小、QA 指标、控制台报错。
- 进入 Codex 只读失败审查。

## 九、 测试环境记录

每次执行大尺寸 JPG 测试时必须记录：

- 测试机器 CPU：
- 测试机器 RAM：
- 操作系统：
- 浏览器名称与版本：
- 是否使用 Chrome 任务管理器观察内存：
- 浏览器内存峰值：
- 测试图片目录：
- 测试图片是否在项目目录外：
- 测试图片是否进入 Git：

## 十、 测试边界

- 大尺寸 JPG 测试即使通过，也只能说明当前设备、当前浏览器、当前样本下表现可接受。
- 不能直接推导 production 可以默认 true。
- 不能证明 HEIC / RAW 已支持。
- 不能证明所有真实客户相册都稳定。
- legacy 仍必须保留。
- `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认仍必须保持 `false`。

## 十一、 后续 Checkpoint 规划
1. **CORE-DUPLICATE-LARGE-JPG-QA**
   - Codex 只读审查本规划。
2. **CORE-DUPLICATE-LARGE-JPG**
   - 执行 100 / 200 张大尺寸 JPG 非隐私测试。（已执行）
3. **CORE-DUPLICATE-LARGE-JPG-RESULT-QA**
   - Codex 审查测试结果。（已执行）
4. **CORE-ZIP-LARGE-FILE-FIX-PLANNING**
   - 规划大文件 ZIP 下载中断修复方案。（当前 Checkpoint）

## 十二、 实际测试结果记录与遗留问题

在 `CORE-DUPLICATE-LARGE-JPG-ZIP-RETRY` 的实际回归补测中，测试发现：
1. **100张相册测试**：保留区（15MB）与淘汰候选区（643MB）ZIP 成功触发并完整下载，数据对齐正确，后缀保留为 `.jpg`。
2. **200张相册测试**：保留区较小体积 ZIP（15MB）成功下载；但淘汰候选区超大体积 ZIP（预计超过 1.2GB）下载发生中断，状态为 `DownloadInterrupted`。
3. **故障原因**：业务代码 `src/app/results/page.tsx` 中在调用 `link.click()` 后，瞬间同步调用了 `URL.revokeObjectURL(downloadUrl)` 释放 Blob。当大包在浏览器底层异步写入磁盘尚未完成时，Blob URL 已经被强行销毁，导致大文件传输中断。

**结论**：大尺寸 JPG 场景下的全链路并未能完全通过测试，ZIP 大包导出功能存在明显的资源提前释放 bug。需要进入专门的大文件 ZIP 下载修复分支（`CORE-ZIP-LARGE-FILE-FIX`）进行独立处理，此问题修复前无法进入下一阶段的 beta readiness。
