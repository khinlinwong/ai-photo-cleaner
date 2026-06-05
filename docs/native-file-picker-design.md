# Native 多选图片文件入口设计方案 (CORE-DESKTOP-NATIVE-FILE-PICKER-DESIGN-FIX-QA-LITE-1)

本设计方案旨在为 AI Photo Cleaner 桌面端提供“多选图片文件”这一独立的文件导入入口，使用户可以在同一个文件夹（或不同位置）下手动选取特定范围的图片进行质量评估和 A/B 对比。

---

## 1. UI 设计与入口展示

### 现有入口与新入口并存
目前 Desktop 起始页（选择相册文件夹的主面板）仅有“选择文件夹”入口。我们将对该界面进行微调，使用双入口并存的布局：

1. **选择相册文件夹 (原有)**
   - **定位**: 适合对一整组相册或整个文件夹进行批量的快速分析。
   - **限制**: 自动扫描整个文件夹中最多 200 张图片。
2. **多选图片文件 (新增)**
   - **定位**: 适合只希望筛选特定照片，或文件分散在不同位置的用户。
   - **限制**: 允许用户多选，但也只允许处理前 200 张。

### UI 交互表现
在起始页面采用卡片式并排设计（或主按钮下方增加次级动作按钮），并在“多选图片文件”入口旁边标注轻量级提示说明：
> 💡 “手动选择一批图片进行筛选评估，当前最多支持分析 200 张图片”

---

## 2. Tauri Dialog 多选文件与权限评估

### 权限评估：不新增任何 Tauri 权限
- 当前多选文件入口**优先复用已授权的 `dialog:allow-open` 权限**。
- **不新增 broad fs 权限**。
- **不新增 shell 权限**。
- **不新增 allow-all 权限**。
- **不开启 `assetProtocol`**。
- **不引入 `updater` / `autostart` / `telemetry` 等不相关模块**。
- Rust 只能处理用户通过 dialog 显式选择并传递的文件路径，不能扫描未授权的目录，也不能进行全盘读取。

### 打开文件选择器参数设计
前端通过 `@tauri-apps/plugin-dialog` 调用 Open Dialog，具体参数配置如下：
```typescript
import { open } from '@tauri-apps/plugin-dialog';

const selectedPaths = await open({
  multiple: true,     // 启用多选
  directory: false,   // 仅选择文件，不选择目录
  filters: [{
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp']
  }]
});
```

---

## 3. 真实路径安全边界与脱敏设计

### 前端不持久化、不显示、不传播真实路径
在使用 Tauri dialog `open()` 返回阶段，前端可能会在 JavaScript 内存中**短暂接收**由文件选择器返回的真实文件路径数组。为了确保绝对的数据隐私和安全，必须严格限制其作用域：

1. **短暂接收与单向传参**:
   - 得到的路径数组**仅允许**作为一次性参数，立即直接传递给 Rust 命令 `scan_selected_image_files(file_paths)`。
   - 前端**绝对禁止**执行以下操作：
     - 将真实路径写入 React state 或任何 context。
     - 将真实路径存入 `localStorage` 或 `sessionStorage`。
     - 在 UI 界面（包括图片卡片、详情弹窗、面包屑、报告预览等）显示真实路径。
     - 将真实路径写入 `report.json` / `manifest.json`。
     - 将真实路径输出至前端 Console 日志或遥测日志。
     - 将真实路径传递给除指定 Rust command 之外的任何其他前端/后端模块。
2. **Token 化抽象**:
   - Rust 侧命令接收到路径后，立即在后端生成唯一的、不可逆的 `opaque token` (即 `previewId` 或 `photoId`)。
   - 随后的所有前端生命周期中，前端只感知和使用这些 `opaque token` 以及如 `Photo-001` / `Photo-002` 这样的逻辑 displayName。

---

## 4. Rust 侧命令与内存映射设计

在 Rust 中新增如下接口，以维护对局与整理阶段的路径安全映射：

### (1) 新增 Rust 侧 Command
```rust
#[tauri::command]
fn scan_selected_image_files(
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>
) -> Result<Vec<NativeImagePreviewItem>, String> {
    // 1. 强制 200 张硬限制拦截 (限制前 200 个文件，多余忽略)
    // 2. 执行 Rust 侧 canonical 检验，校验路径是否合法存在且是有效图片文件
    // 3. 依次为每个真实路径生成一个随机的 UUID/Token 作为 ID (例如 "token_abc123")
    // 4. 在 Rust 的 AppState 内存注册表中，建立 "token_abc123" -> "C:\real\path.jpg" 的映射
    // 5. 返回 NativeImagePreviewItem 列表，其中 item.id 为 token，previewUrl 为本地图片预览数据
}
```

### (2) 内存映射注册表 (`selectedFilesSourceRegistry`)
- 映射关系只存活在 Rust 后端内存中（受线程安全读写锁 `Mutex` / `RwLock` 保护），永不暴露给前端。
- 原有的文件夹模式可继续使用 `verify_in_active_folder` 进行单一文件夹内校验。
- 新增的多选文件模式将通过上述 `selectedFilesSourceRegistry` 进行校验，不强行复用只适合单文件夹的 `verify_in_active_folder`。

---

## 5. 多文件夹来源下 Copy-Only 物理整理安全策略

在多选文件模式下，用户选择的图片可能来自不同的本地文件夹。执行整理物理复制时需遵循以下安全规则：

### (1) 复制执行拦截
- 前端在触发 `executePhysicalOrgCopy` 时，提交的信息仅包含 `photoId` (即 Token) 和整理状态计划（`keep` / `cull`）。
- Rust 侧根据 Token 反查内存映射表，获取对应的真实物理源文件路径。
- Rust 对源文件路径再次进行 canonical 校验，然后将其**复制**到输出目录中对应的 `Keep/` 或 `Cull-Candidates/` 子文件夹。
- 坚持 `copy-only` 的安全底线：**绝对不移动 (move)、不删除 (delete)、不覆盖 (overwrite) 任何原图**。

### (2) 输出目录重叠安全拦截 (Overlap Guard)
为了防止用户操作不当导致原图文件夹受到污染或死循环写入，引入严格的安全距离校验：
- **拦截规则**:
  - 输出文件夹的绝对路径，不得与任意一个源文件所在的文件夹路径相同。
  - 输出文件夹的绝对路径，不得是任意一个源文件所在文件夹的子目录。
  - 输出文件夹路径，不得包含任意一个源文件的路径。
- **校验流程**:
  在执行复制前，Rust 遍历当前所有源文件的真实目录与输出目录绝对路径进行比对。如发现任何重叠风险，**拒绝执行**复制，并返回经过脱敏的错误信息：
  > “输出位置不可用，请重新选择输出位置。”

---

## 6. HEIC / HEIF 兼容跳过策略

- HEIC / HEIF 不作为第一阶段的重点支持格式。
- 如果用户通过系统的多选文件 dialog 强行选入 HEIC/HEIF 格式，Rust 端与前端 pipeline 将沿用现有的降级跳过策略：
  - 标记该文件的分类为 `'已跳过'`。
  - UI 诊断信息显示“文件格式不支持 (HEIC/HEIF)，已跳过处理”。
  - 整个分析流程和对局不会因为单个 HEIC 文件的读取跳过而崩溃。

---

## 7. report.json 隐私脱敏规范

生成的 `report.json` 中必须做到完全的脱敏，不得包含任何可能追溯到用户隐私的信息：
- **禁止包含**:
  - 本地真实的物理路径（如 `C:\Users\username\Pictures\photo.jpg`）。
  - 真实的相片文件名。
  - Windows 系统用户名（如路径中的 `\Users\khinl\...` 部分）。
  - Opaque Token / SourceId 与真实路径的任何可逆映射。
- **只允许包含**:
  - 基于逻辑标号的名字（如 `Photo-001` / `Photo-002`）。
  - 分类整理结果 (`keep` / `review` / `delete`)。
  - 复制执行状态（`copied` / `skipped` / `failed`）。
  - 去隐私的诊断提示（如“质量良好”、“画面模糊”）。

---

## 8. 后续开发实现步骤拆分

为了确保开发过程小步快跑、稳定闭环，后续实现拆分为以下 5 个阶段：

### A. `FILE-PICKER-A-DIALOG-UI` (前端 UI 与 Dialog 多选)
- 在 Desktop 起始页实现卡片并列的 UI 布局，提供“选择图片”入口。
- 调用 Tauri open dialog 进行文件过滤和限制参数设置。
- 前端拿到路径后立即传递给 Rust，不在 React state / context 中持久化。
- 本阶段不打通完整的处理和 Results 流转。

### B. `FILE-PICKER-B-RUST-SELECTED-FILES-COMMAND` (Rust 选图扫描 Command)
- 在 Rust 中创建 AppState 内存映射注册表 `selectedFilesSourceRegistry`。
- 实现 `scan_selected_image_files` 命令。
- 实现 canonical 路径校验、图片格式过滤、200 张上限拦截截断。
- 返回脱敏的预览 item 数组。

### C. `FILE-PICKER-C-PIPELINE-INTEGRATION` (前端 Pipeline 整合)
- 前端接收 previews 并调用 `startNativeFolderAnalysis`。
- 打通 `/processing` 分析、Results 页流转、Similar Groups 识别与 A/B 挑选。
- 确保原有“选择文件夹”分析入口和对局管线没有任何退化。

### D. `FILE-PICKER-D-COPYONLY-REPORT-QA` (物理复制与报告脱敏)
- 适配多选模式下的 `executePhysicalOrgCopy`，使用内存映射反查路径。
- 实现输出与源路径重叠拦截保护机制。
- 验证生成的 `report.json` 与 `manifest.json` 符合脱敏规范。
- 确保 Native ZIP 导出在多选模式下依然被严格禁用。

### E. `FILE-PICKER-E-REALWORLD-QA` (真实场景测试)
- 测试同文件夹下多选图片分析。
- 测试跨不同文件夹多选图片分析。
- 测试选择超过 200 张时的自动截断。
- 测试大图、损坏图、HEIC 文件的自动降级跳过。
- 校验取消、失败、无相似组场景下的正常 Results 跳转。
- 进行 Web / Demo 端的完整回归测试。
