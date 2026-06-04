# Native 200 张批量处理扩容实现计划：CORE-DESKTOP-NATIVE-BATCH-SCALE-200-IMPLEMENT-PLAN-FIX-QA-LITE-1

## 1. 背景
AI Photo Cleaner 桌面端（Native）已稳定在最大处理 100 张照片的基线上。为了进一步满足用户 200 张批量照片的整理需求，我们必须在保障内存安全、响应平滑、控制自如的前提下制定此扩容实现计划。200 张批量处理如果暴力修改常量极易触发 V8 堆溢出 (OOM) 导致 Tauri 进程崩溃。

本轮工作**只做实现计划修正，不实现代码，不修改产品代码**。后续开发阶段将遵循此计划，分阶段、小步推进 200 张的扩容实现与 QA 回归。

## 2. 当前 100 张稳定基线
目前，系统已稳定在 100 张的处理规模下：
- **核心限额**：
  - Native 预览扫描限制：`PREVIEW_LIMIT = 100`。
  - Native 核心分析限制：`NATIVE_PROCESSING_MVP_LIMIT = 100`。
- **读取与分析逻辑**：
  - 底层继续采用**单队列串行读取**与**串行分析**模式（queue depth = 1），无任何 Promise.all 并发行为。
  - 单张照片最大字节数限制为 `15MB`，超出此限制将优雅跳过。
  - 遇到 `HEIC / HEIF` 格式时自动安全跳过，以规避 Canvas 解码失败。
- **内存安全**：
  - 原始照片的二进制字节流（bytes）及 Blob 对象在分析完相应帧后立即释放，**绝不进入 React 全局 State**，仅保留脱敏后的质量分析指标和 opaque ID。
- **取消与中断机制**：
  - 在分析队列执行时，可通过“停止分析”按钮进行安全打断。
  - 中断后，**已分析部分的数据（0 到 M 张）予以保留**，允许用户手动跳转查看已分析的建议；未分析的图片状态保持默认的 `keep`，并不自动启动 Similarity Group 或 AB 战役。
- **整理输出机制**：
  - 采用 **Copy-Only 物理整理**，将保留照片拷贝到新生成的 export 会话文件夹下，规避物理 `move`、`delete` 或 `overwrite` 风险。
  - 脱敏的 `report.json` 会随物理拷贝同步输出，且整个处理过程中完全对真实路径、真实文件名进行脱敏显示。
  - 本地模式下的 Native ZIP 导出被逻辑禁用。
- **Web 与 Demo 端**：
  - 纯网页版和演示模式运行正常，未发生任何倒退。

## 3. 为什么不直接实现 200
直接将 100 改为 200 会带来以下系统性风险，因而必须走灰度开关与分步验证的实现计划：
1. **Chromium / V8 垃圾回收滞后与堆溢出 (OOM)**：
   - 200 张图片的高频 Canvas 像素提取、哈希特征提取与曝光评分等计算会产生大量的内存垃圾。由于垃圾回收是异步的，连续串行 200 次而不给主线程休眠时间容易导致内存持续飙升，触发 OOM 崩溃。
2. **Tauri IPC 管道拥堵**：
   - 200 次高频读取 15MB 内的本地图片，使得渲染进程与主进程频繁交互，IPC 数据拷贝和主线程负载翻倍，容易发生卡顿。
3. **用户焦虑与程序无响应**：
   - 200 张分析耗时将翻倍（约 2-4 分钟）。如果没有任何分阶段进度指示或中途卡在某张图上，且无平滑的停止打断反馈，用户体验会严重倒退。
4. **状态与 UI 渲染负担加倍**：
   - 200 张图片的列表渲染、相似组匹配计算复杂度升高，PK (Photo Battle) 的组数大幅增加，将给前端带来渲染负荷。

## 4. Feature Flag / Fallback 方案与 Plumbing 机制
为保障稳定性，后续 200 张的实现必须采用 **Feature Flag (灰度开关)** 并辅以安全的传递与 Clamp 机制进行隔离，具体机制设计如下：

### 4.1 前端开关控制
- 在 `src/lib/config/featureFlags.ts` 中新增灰度开关 `NATIVE_BATCH_LIMIT_EXPERIMENTAL_200`。
- **默认状态必须关闭**：`export const NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 = false;`。
- **统一计算有效限制 (effectiveNativeBatchLimit)**：
  - 前端定义或通过新增的轻量 helper（如 `src/lib/desktop/nativeBatchLimit.ts`）统一计算：
    - 开关为 `false` 时，`effectiveNativeBatchLimit = 100`。
    - 开关为 `true` 时，`effectiveNativeBatchLimit = 200`。
  - **预览、处理与 UI 文案三者强制对齐**：
    - 预览：`scanNativeFolderImagePreviews` 传递的 limit 限制数必须为 `effectiveNativeBatchLimit`。
    - 处理：分析时限制截断为 `previews.slice(0, effectiveNativeBatchLimit)`，杜绝“预览 200 张但实际分析 100 张”或反向的情况。
    - UI 文案：界面上的最多导入/分析提示，必须动态显示此限制数值。

### 4.2 管道传递机制 (Plumbing Mechanism)
- **Rust 不直接读取前端的 `featureFlags.ts` 文件**。
- **Tauri Command 参数传递**：
  - 前端调用 Rust command `scan_folder_image_previews` 时，必须显式将前端计算的 `effectiveNativeBatchLimit` 作为参数传给底层（例如：`scan_folder_image_previews(folder_path, limit)`）。
- **Rust 端安全 Clamp 二次防护**：
  - Rust 核心预览解析函数（如 `scan_folder_image_previews` 内）必须对传入的 `limit` 进行二次 Clamp：
    - `let final_limit = std::cmp::min(limit.unwrap_or(100), 200);`
    - 若前端未传递 `limit` 参数或传入 0，则默认降级为 100。
    - **禁止越权拦截**：绝对禁止前端传递任意大数（如 999 / 9999）从而导致底层发生全量文件夹扫描分析。

### 4.3 稳定性与安全保护
- 灰度开关不影响 Web 与 Demo 端逻辑，Web/Demo 上限继续保持完全独立。
- **100 张 Fallback 永远可用**：若 200 张实验版出现异常，在前端 feature flags 重新将开关置为 `false`，即可一键重置 `effectiveNativeBatchLimit` 为 100，无需改动 Rust 核心逻辑或物理复制逻辑，且不破坏 100 张的稳定逻辑路径。

## 5. 后续 Checkpoint 拆分
200 张批量处理的实现将拆分为以下 3 个 Checkpoint：

### Checkpoint A：Feature flag / limit plumbing only
- **目标**：建立 Feature Flag 切换常数限额的前后端安全通道，默认仍然保持 100 张，不真正开启 200 张。
- **开发范围**：
  - 在 `src/lib/config/featureFlags.ts` 中新增 `NATIVE_BATCH_LIMIT_EXPERIMENTAL_200 = false` 灰度开关。
  - 修改 `scanNativeFolderImagePreviews`（前端与 Rust 接口）和 Rust `scan_folder_image_previews` 命令，支持 `limit` 参数传递。
  - Rust 底层实现对 `limit` 参数的安全 Clamp 防护（限制最大值为 200，前端未传或传 0 时默认设为 100，杜绝任意大数导致的越权全量扫描）。
  - 前端 preview / processing 及 UI 文案提示（如 `LocalProjectStart.tsx`）统一绑定为依据该 Flag 动态生成的 `effectiveNativeBatchLimit`（当 flag 为 `false` 时显示并限制为 100 张）。
- **禁止修改/启用行为**：
  - 默认情况下不启用 200 限制。不把默认行为改成 200。
  - 不进行 200 张的大批量压测，只针对 100 张基线进行回归测试，确保通道建立后 100 张逻辑无任何退化。
  - 不新增 Promise.all / Worker / SQLite，不新增 Tauri 权限，不修改 Copy-Only 复制逻辑及 `report.json` 脱敏 Schema。

### Checkpoint B：200 experimental enable
- **目标**：在实验分支/测试环境中将开关开启，放宽至 200 张限制，调整对应 UI 文案提示，并检验基础链路。
- **开发范围与策略**：
  - **只限实验 checkpoint/分支进行验证**：将 `NATIVE_BATCH_LIMIT_EXPERIMENTAL_200` 临时或在实验环境中设为 `true`。
  - 此时 `effectiveNativeBatchLimit` 在前端和 Rust 端应用为 200。
  - 界面 UI 文案依据 effective 限额自动切换为“最多分析 200 张”。
  - 底层串行队列与休眠窗口继续保持（仍串行，仍 15MB 限制，无并发）。
  - **测试版本规范**：此修改只限于实验验证。除非在 Checkpoint C 完成了真实的 QA 并确认其安全性与稳定性，否则**不能作为默认稳定配置直接合并或向正式环境提交**。如果向正式环境合并，主分支的灰度开关默认仍必须为 `false`。

### Checkpoint C：200 real-world QA
- **目标**：执行全方位的性能与稳定性压测，完成 200 张级别的功能回归与测试，确保系统不崩溃、不漏隐私。
- **验证范围**：
  - 进行 30 / 50 / 100 / 200 分级相册规模压测。
  - 执行 220 / 250 张超额文件截断测试（确认仅读取/分析前 200 张，超出部分不进入分析也不崩溃）。
  - 中途打断测试：200 张分析中途手动点击“停止分析”，确认已分析结果在 React 状态中保留，未分析照片标记为已跳过且不进入淘汰候选，不自动触发 Results / Similar Groups / A-B PK / 物理复制流程。
  - 回归测试以下功能模块：
    - **Native Results**：确认 200 张或部分取消后的结果页可正常显示、滚动（结合虚拟滚动列表）、统计。
    - **Native Similar Groups**：确认用户手动点击触发识别，且识别出的分组逻辑正确，计算不阻塞主线程。
    - **Native A/B**：确认用户手动点击触发 Photo Battle，PK 轮次和决策能顺利完成。
    - **Native copy-only physical org**：确认物理整理正常，session 目录创建、同名规避生效。
    - **report.json 脱敏**：检查导出的 `report.json` 文件，确认不泄露真实的路径、文件名和用户名。
    - **Native ZIP 禁用**：确认本地模式下的 ZIP 导出按钮被逻辑拦截。
    - **Web / Demo 兼容性**：验证网页端的上传、结果、ZIP/CSV/JSON 导出以及 Demo 的相似性与PK。

## 6. 允许修改范围
未来实施 200 张限制阶段，仅允许修改/新增以下文件：
- [featureFlags.ts](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/lib/config/featureFlags.ts)：用于新增 `NATIVE_BATCH_LIMIT_EXPERIMENTAL_200` 灰度开关。
- [nativeImagePreviewScanner.ts](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/lib/desktop/nativeImagePreviewScanner.ts)：用于适配传参 limit 给 Rust command。
- [src-tauri/src/lib.rs](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src-tauri/src/lib.rs)：用于根据参数 limit 进行 Clamp 处理并放开 Rust 扫描上限。
- [PhotoWorkspaceContext.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/context/PhotoWorkspaceContext.tsx)：根据有效限制 `effectiveNativeBatchLimit` 控制分析截断和批次休眠。
- [LocalProjectStart.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/components/desktop/LocalProjectStart.tsx)：根据有效限制动态显示最大可导入张数的 UI 文案提示。
- [nativeBatchLimit.ts](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/lib/desktop/nativeBatchLimit.ts)：（如果需要桥接 helper，允许新增/修改此轻量前端 helper）。
- [native-batch-scale-200-implement-plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/docs/native-batch-scale-200-implement-plan.md)：本实现计划文档。

## 7. 禁止修改范围
为保护核心资产并避免发生未知退化，以下代码及机制**严禁修改**：
- **Tauri Capability 与权限**：禁止修改 `tauri.conf.json` 中的权限配置或 `capability`（特别是广域文件系统、shell、allow-all 权限），不新增任何 Tauri 权限。
- **自定义资产协议**：禁止启用或修改 `assetProtocol`。
- **物理整理复制核心**：禁止修改物理复制的核心文件创建与磁盘写入逻辑（如 `OpenOptions::new().write(true).create_new(true).open()` ），保护原图绝对只读。
- **脱敏格式与 Schema**：禁止修改 `report.json` 的脱敏结构和会话目录隔离规约。
- **Web / Demo 主逻辑**：网页端的多文件上传、压缩及演示数据加载逻辑严禁修改。
- **Native ZIP 拦截器**：用于拦截本地模式下 ZIP 导出的逻辑严禁修改或绕过。
- **核心状态机**：相似度匹配的核心算法及 PK Battle 轮次转换状态机严禁重写。

## 8. 安全边界
在后续实施中，系统必须死守以下安全红线：
- **单队列串行**：读取与 Canvas 分析必须为单队列串行（queue depth = 1），绝对禁止使用并发或 `Promise.all`。
- **零 Worker & 零 SQLite**：禁止使用 Web Worker 以及 SQLite 等本地数据库，所有状态均在前端 React Context 内存中维护。
- **零 Native ZIP**：本地模式下继续保持 ZIP 导出的逻辑禁用。
- **零物理破坏**：只能进行 Copy-Only 物理拷贝，绝对禁止执行物理的 `move`、`delete` 或 `overwrite`，绝不改动或破坏用户的源文件夹及原图照片。
- **脱敏与本地隐私**：禁止将任何数据上传至云端；禁止在 UI 页面、控制台、导出报告中输出或显示真实的物理路径、真实文件名、sourceId 或 previewUrl。
- **内存防溢出**：读取原图生成的 bytes / Blob 绝不能进入 React 全局 State，在分析完成后必须立即 revoke 释放，ImageData 等引用显式置为 null，垃圾回收时间出让生效。
- **单图限制与格式跳过**：单张最大 15MB 限制、HEIC/HEIF 扩展名自动跳过逻辑保持生效。

## 9. QA 策略
每次提交 Checkpoint 前均需执行以下回归，确保质量无虞：

### 9.1 静态与命令校验
- `git status --short`：确认工作区无杂乱代码修改。
- `git diff -- src/lib/config/featureFlags.ts`：确认 featureFlags 与当前 checkpoint 预期一致（特别是默认关闭状态）。
- `npm.cmd run build`：确保项目能成功静态编译及导出。
- `npm.cmd run lint`：确保无规范与类型警告。
- `npm.cmd run desktop:dev`：验证 Tauri 能正常编译拉起。

### 9.2 分级压测与截断校验
- **分级测试**：分别跑通 30 张、50 张、100 张及 200 张（Checkpoint B及以后）的本地分析。
- **截断测试**：准备包含 220 张及 250 张照片的文件夹，确认系统仅取前 200 张进行预览及处理，超出部分直接安全忽略，系统不全量扫描，也不崩溃。
- **格式混合校验**：测试相册中需混合 `jpg`, `jpeg`, `png`, `webp` 以及 `HEIC / HEIF`、`损坏文件`、`>15MB超大图`。确认 HEIC 和超大图被安全跳过（默认 status 为 keep，不崩溃），损坏图优雅跳过并标记失败。

### 9.3 功能模块回归校验
功能回归必须包含且单独列出验证：
- **Native Results**：确认 200 张或部分取消后的结果页可正常显示、滚动（结合虚拟滚动列表）、统计。
- **Native Similar Groups**：确认用户手动点击触发识别，且识别出的分组逻辑正确，计算不阻塞主线程。
- **Native A/B**：确认用户手动点击触发 Photo Battle，PK 轮次和决策能顺利完成。
- **Native copy-only physical org**：确认物理整理正常，session 目录创建、同名规避生效。
- **report.json 脱敏**：检查导出的 `report.json` 文件，确认不泄露真实的路径、文件名和用户名。
- **Native ZIP 禁用**：确认本地模式下的 ZIP 导出按钮被逻辑拦截。
- **Web / Demo 兼容性**：验证网页端的上传、结果、ZIP/CSV/JSON 导出以及 Demo 的相似性与PK。

### 9.4 取消与中断异常流
- **中途打断**：在分析至 30 张、80 张、150 张时分别点击“停止分析”：
  - 确认当前单图分析完后安全中断，不崩溃。
  - 确认已分析的图片被保留在 React State 中，未处理的照片维持默认 `keep` 状态。
  - 确认不自动跳转 Results，不自动识别相似性重复，不自动开启 AB 对决。
  - 确认界面展示“已停止”，允许用户手动跳转。

## 10. 回滚策略 (Fallback Strategy)
- **100 张 Fallback 路径的永远可用**：
  - 系统在任何时候都不删除或破坏已稳定的 100 张物理代码分支及读取/处理机制。
- **一键回滚操作**：
  - 若 200 张实验版在大规模测试中发生内存泄漏、挂起或崩溃，操作人员只需在 `featureFlags.ts` 中将 `NATIVE_BATCH_LIMIT_EXPERIMENTAL_200` 灰度开关重置为 `false`。
  - 重置后，不需要修改 Rust 端底层安全逻辑，不需要改动物理复制，也不需要修改 `report.json` 脱敏 schema。前端将有效限额 `effectiveNativeBatchLimit` 降级为 100，系统会立即平滑回退到 100 张的常规稳定路径。

## 11. 推荐下一 Checkpoint
- `CORE-DESKTOP-NATIVE-BATCH-SCALE-200-IMPLEMENT-A` (进入灰度开关与传参 Clamp 管道的建立，默认关闭开关，执行 100 张常规回归，只修 featureFlags、previewScanner 及 workspaceContext 等的传参与 clamp Plumbing 逻辑)。
