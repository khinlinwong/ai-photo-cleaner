# AI Photo Cleaner 大文件 ZIP 下载中断修复规划 - CORE-ZIP-LARGE-FILE-FIX-PLANNING

## 问题背景

在 `CORE-DUPLICATE-LARGE-JPG-ZIP-RETRY` 测试中：
1. 100 张大尺寸 JPG 保留区 ZIP 下载通过。
2. 100 张大尺寸 JPG 淘汰候选区 ZIP 下载通过，大小约 643MB。
3. 200 张大尺寸 JPG 保留区 ZIP 下载通过，大小约 15MB。
4. 200 张大尺寸 JPG 淘汰候选区 ZIP 下载中断，浏览器下载状态为 `DownloadInterrupted`。
5. 200 张淘汰候选区大包的实际文件大小预计超过 1.2GB。
6. 测试全链路的 parity / processing / results / Photo Battle 均运行正常。
7. 问题集中在大体积 ZIP 异步下载及磁盘写入阶段。

## 疑似原因

当前 `src/app/results/page.tsx` 中的 `downloadPhotosZip` 导出函数存在以下风险调用模式：
1. JSZip 在前端生成压缩包 Blob。
2. 调用 `URL.createObjectURL(blob)` 创建临时的 `downloadUrl`。
3. 动态创建 `a` 标签并调用 `link.click()` 触发浏览器下载。
4. 在下一行同步且立即调用了 `URL.revokeObjectURL(downloadUrl)` 释放 Blob 对象。

风险分析：
- 浏览器下载和向磁盘写入大文件是一个异步的 I/O 行为。
- 对于几十兆的小文件，浏览器底层可能瞬间已将数据读入内存，因此即使立即 `revoke` 也不会引发错误。
- 对于超过 1GB 的超大文件，浏览器底层在传输数据并写入磁盘时需要一定的时间。如果 JS 主线程在 `click()` 后瞬间将 Blob 内存资源强行释放，浏览器底层的下载线程会因为找不到源 URL 的内存数据而发生中断，从而抛出 `DownloadInterrupted` 错误。

## 最小修复方向

第一阶段建议采用对现有代码改动最小、低风险的修复方案。

### 方案 A：延迟 revokeObjectURL (首选方案)

**逻辑方向：**
在 `link.click()` 触发下载后，不立刻执行 `URL.revokeObjectURL`，而是将其放入一个定时器，延迟释放。

```typescript
link.click();
document.body.removeChild(link);

// 延迟 120 秒释放 Object URL，给超大文件下载写入磁盘留出充裕的传输时间
setTimeout(() => {
  URL.revokeObjectURL(downloadUrl);
}, 120_000);
```

**优点：**
- 代码改动极其微小，只需简单调整 `revoke` 时机。
- 不影响 JSZip 打包逻辑和分区逻辑。
- 不影响任何现有的 UI 交互和样式。
- 能安全应对大体积文件的异步导出。

**风险与边界：**
- **短期权宜方案**：延迟释放 `URL.revokeObjectURL` 仅作为短期浏览器原型的最小修复手段，并非解决大文件导出的长期最佳架构。
- **经验阈值限制**：`setTimeout 120_000ms` 是基于经验设定的数值，不能作为 100% 写入成功的物理保证。
- **内存驻留上升**：由于延迟释放，大体积 Blob 资源会在浏览器内存中强制保留更久。若用户在 120 秒内连续多次导出 1GB+ 的超大包，可能导致内存开销峰值显著上升。
- **降级路线清晰**：若方案 A 在实际测试中依然触发中断，本规划建议启动方案 B 进行集中 pending URLs 生命周期管理；若依然受限，将通过长期技术路线解决。
- **底层资产无侵入**：本规划绝对不改动 JSZip、分区逻辑、Photo Battle 决策引擎、feature flag 或 Context 流程。

---

## 更稳妥的短期方案

### 方案 B：集中管理 pending download URLs

**逻辑方向：**
设计一个全局或组件级别的 URLs 数组/集合来集中管理等待清理的 `downloadUrl`：
- 在组件中维护一个 pending URLs 队列。
- 每次启动新的 ZIP 导出前，自动清理并释放上一次已经过期或不再需要的 URL 内存。
- 在页面卸载（Unmount）或组件销毁时，统一执行 `revokeObjectURL` 以防止内存泄漏。
- 同样不采用在 `link.click()` 后立即 `revoke` 的同步写法。

**优点：**
- 内存释放时机比单纯的 `setTimeout` 更加可控。
- 避免了长时间累积 ObjectURL 带来的潜在内存隐患。
- 更加适应后续用户可能频繁点击导出的大文件交互场景。

**风险：**
- 需要在 React 组件中引入生命周期管理，改动范围比方案 A 略大。

---

## 不做事项

当前修复阶段中，以下事项明确不做：
- 不重写或替换现有的 JSZip 压缩系统。
- 不引入任何外部新的第三方压缩或流式打包依赖。
- 不引入 Web Worker 进行异步后台 ZIP 打包。
- 不做流式（streaming）ZIP 下载。
- 不针对 Tauri 环境进行原生端文件复制/打包。
- 不改变前端分类分区判定逻辑。
- 不改变 Photo Battle 状态机及其决策逻辑。
- 不修改 `USE_SIGNAL_GROUPS_FOR_BATTLE` 的预设值或改变分支流转。
- 不把 ZIP 下载中断的修复与 signal groups true 分支的正式切换混淆进行。

---

## 长期方向

- **Web Worker ZIP 打包**：将压缩计算转移到后台线程，避免大包时卡死 UI 主线程。
- **分批导出**：对于超大规模相册，支持按大小或按相似组分批打包下载。
- **流式 ZIP（Stream ZIP）**：采用流式机制边压缩边下载，大幅减少前端内存积压。
- **Tauri 原生导出**：直接调用 Rust 端的原生 I/O 进行物理文件复制与打包。
- **UI 优化**：在导出大文件时，提供明确的打包进度百分比、预计体积提示及取消按钮。

---

## 实现边界

在未来正式实现 `CORE-ZIP-LARGE-FILE-FIX` 时，文件修改应遵守以下边界：

**允许修改：**
- `src/app/results/page.tsx`
- 修复相关的 md 文档说明

**禁止修改：**
- `PhotoWorkspaceContext` 主流程及核心状态
- `duplicate` / `analysis` 核心去重与分析算法
- Photo Battle 对局状态机
- `getUserVisibleBucket` 照片分类判定函数
- `src/lib/config/featureFlags.ts` 中特征开关的默认值
- `package.json` / `package-lock.json` 等依赖管理文件

**实现要求：**
- 仅修改 ObjectURL 的生命周期与清理时机。
- 不改动 ZIP 内打包照片的筛选与判定逻辑。
- 不改变按钮字面文案及 UI 表现。
- 构建（build）与静态检查（lint）必须 100% 成功通过。

---

## 回归测试方案

修复实现后，必须进行全方位的回归测试，验证 ZIP 打包在各种体量下的可靠性。

### 基础验证：
- 导出 Demo 项目 ZIP。
- 导出普通体量小图相册 ZIP。
- 导出 100 张大尺寸 JPG 相册 ZIP。
- 导出 200 张大尺寸 JPG 相册 ZIP。

### 测试重点：
- 100 张保留区 ZIP 与 淘汰候选区 ZIP。
- 200 张保留区 ZIP 与 淘汰候选区 ZIP。

### 需记录指标：
- 各分区 ZIP 是否被实际点击并触发。
- ZIP 是否成功完成下载到本地。
- ZIP 下载后的实际文件大小。
- 导出 ZIP 耗时（压缩与下载）。
- 解压 ZIP 确认内部文件结构、数量是否与页面分区及 Photo Battle 决策一致。
- 确认 ZIP 内照片文件均保留 `.jpg` 原始后缀。
- 是否再次发生 `DownloadInterrupted` 错误。
- 浏览器控制台是否有关于 ObjectURL 或内存泄漏的错误报错。
- Chrome 任务管理器观察内存是否有异常飙升。

---

## 通过标准

- 200 张大尺寸 JPG 淘汰候选区（超 1.2GB 大包）ZIP 成功下载且数据完好。
- 没有任何 ZIP 下载发生 `DownloadInterrupted` 中断。
- ZIP 内部解压文件和页面分区完全对齐。
- ZIP 文件内照片完整保留原 JPG 后缀名。
- 兼容性良好，原有小相册的 ZIP 导出不受任何负面影响。
- Photo Battle 状态机、results 页面的列表滚动均维持正常。
- 构建和 Lint 静态检查无报错。
- `featureFlags.ts` 的 `USE_SIGNAL_GROUPS_FOR_BATTLE` 维持 `false` 不变，无任何脏提交。

---

## 失败处理

- 若在应用延时释放 Object URL 后仍然出现 `DownloadInterrupted` 中断，应立刻停止继续扩大测试范围。
- 记录故障时的 ZIP 实际大小、下载耗时、控制台错误及系统内存。
- 评估是否需要从方案 A（setTimeout）升级为方案 B（集中管理 pending URLs 并精细化生命周期管理）。
- 如果依然无法克服超大文件的 Object URL 瓶颈，再启动新规划评估引入 Web Worker 或原生 Tauri 导出方案。
- 在大尺寸 JPG ZIP 大包下载存在任何中断隐患前，不允许将其标记为“通过”。
