# Native 多选图片文件入口设计方案 (CORE-DESKTOP-NATIVE-FILE-PICKER-DESIGN-1)

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

### 权限评估：不新增 Tauri 权限
- 现有 `capabilities/default.json` 已经拥有 `dialog:allow-open` 权限。
- 我们**不需要新增任何 Tauri 权限**，也**不开启 `assetProtocol`**，以保持严格的安全隔离边界。

### 打开文件选择器参数设计
前端通过 `@tauri-apps/plugin-dialog` 调用 Open Dialog，具体参数配置如下：
```typescript
import { open } from '@tauri-apps/plugin-dialog';

const selectedPaths = await open({
  multiple: true,     // 启用多选
  directory: false,   // 仅选择文件，不选择目录
  filters: [{
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp'] // 首批支持格式，HEIC/HEIF保持现有跳过策略
  }]
});
```

---

## 3. Rust 侧命令设计（安全性与隐私）

### 路径安全设计 (方案 A)
为避免在前端暴露和留存真实文件路径，本方案采用 Rust 侧命令进行内存化管理的方案，使前端完全与真实路径脱敏：

#### (1) 新增 Rust 侧 Command
在 Rust 中新增如下接口：
```rust
#[tauri::command]
fn scan_selected_image_files(
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>
) -> Result<Vec<NativeImagePreviewItem>, String> {
    // 1. 进行 canonical 校验，过滤非图片格式，并截断为前 200 个文件
    // 2. 依次为每个真实路径生成一个随机的 UUID/Token 作为 ID (例如 "token_abc123")
    // 3. 在 Rust 的 AppState 内存注册表中，建立 "token_abc123" -> "C:\real\path.jpg" 的映射
    // 4. 返回 NativeImagePreviewItem 列表，其中 item.id 为 token，previewUrl 为 Tauri v2 的本地预览 URL
}
```

#### (2) 内存注册表管理
真实文件路径保存在 Rust 内存中，前端 state、results 页面以及生成的 JSON/CSV 报告均只感知和显示脱敏后的标识符（例如 `Photo-001` / `Photo-002`）。

---

## 4. 前端 Pipeline 复用与兼容

由于返回的数据结构为 `NativeImagePreviewItem` 列表且 ID 经过了 Token 化处理，我们可以完全无缝复用现有的前端 pipeline：

```
+------------------+
| 前端 Dialog 多选  |
+--------+---------+
         | (真实路径列表)
         v
+--------+---------+
| scan_selected... |  (Rust Command 转换：验证并生成随机 Token 映射，保存在 Rust 内存)
+--------+---------+
         | (脱敏后的 NativeImagePreviewItem 列表)
         v
+--------+----------------------------+
| startNativeFolderAnalysis(previews) |  (前端 pipeline 接收，将 id/url 保存至 photos 状态)
+--------+----------------------------+
         |
         v
+--------+---------+
| /processing 渲染  |  (基于 readNativePreviewBytes 和 analyzeImageFromBlob 逐个分析)
+--------+---------+
         |
         v
+--------+---------+
|  /results 整理   |  (Similar Groups 自动识别 / Results 页面 / A/B 挑选 / 物理复制)
+------------------+
```

### 物理复制与报告单兼容
- **报告单脱敏**: 导出的 `report.json` 与 `manifest.json` 保持现有策略，不记录用户真实路径，只导出基于 `Photo-XXX` 逻辑名称和 MD5 的整理报告。
- **物理整理复制 (copy-only)**:
  - 当前端触发 `executePhysicalOrgCopy` 时，将包含 `photoId` (即 Token)。
  - Rust 侧在接收到 `photoId` 后，从内存映射表中反查出真实的本地源文件路径，并复制到用户选择的输出目标文件夹。
  - 维持 `copy-only` 的安全策略，绝对不修改、不移动、不删除原文件。

---

## 5. 限制与安全防护指标

- **200 张硬限制**: 在前端 `open` 选择返回后和 Rust `scan_selected_image_files` 处理时均强制截断，只处理前 200 张。UI 上需明确提示“当前处理已限制为前 200 张照片”。
- **Native ZIP Guard 保持**: 保持禁用 Native ZIP，手动多选图片同样只支持 `copy-only` 物理整理输出。
- **防止泄露**: 前端和日志中绝对不输出真实的文件路径。

---

## 6. 后续实现步骤拆分

为了稳步迭代并防止引入回归 Bug，后续开发将拆分为以下 5 个小 checkpoint：

1. **`FILE-PICKER-A` (前端 UI 与 Dialog 多选)**
   - 在 Desktop 起始页实现卡片并列的 UI 布局，提供“选择图片”入口。
   - 调用 Tauri open dialog 进行文件过滤和限制参数设置。
2. **`FILE-PICKER-B` (Rust 选图扫描 Command 实现)**
   - 在 Rust 中创建 `AppState` 内存映射模块（支持线程安全读写）。
   - 实现 `scan_selected_image_files` 命令，生成脱敏的预览 Token。
3. **`FILE-PICKER-C` (前端 Pipeline 串联与分析对接)**
   - 前端接收 previews 并调用 `startNativeFolderAnalysis`，通过 `/processing` 逐个加载图片像素分析。
   - 验证无相似组和有相似组在结果页的流转是否正常。
4. **`FILE-PICKER-D` (物理复制与报告回归)**
   - 修改 `executePhysicalOrgCopy` 的底层路径解析机制，支持从内存映射中获取源文件真实路径进行复制。
   - 验证生成的 `report.json` 脱敏效果。
5. **`FILE-PICKER-QA` (整体测试)**
   - 使用包含各种常见格式的测试用例进行多选测试、大批量限制测试。
