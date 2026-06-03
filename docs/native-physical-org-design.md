# Native 本地物理整理与文件组织安全设计方案 (Draft)

本设计方案规划了 AI Photo Cleaner 在本地桌面端（Tauri）安全实现“本地物理整理 / 文件组织”的整体架构与安全防护机制。核心目标是在**完全不修改、不自动删除用户原图**的前提下，允许用户将整理结果（保留照片与淘汰候选照片）复制到新指定的安全输出文件夹。

---

## 1. 背景与产品定位

AI Photo Cleaner 是一款以“默认本地处理、不上传云端、原图保持不变、用户决定一切”为产品原则 of 智能照片清理与整理工具。
目前已实现了：
- 桌面端本地文件夹扫描元数据、预览图展示。
- 串行读取单张图像素进行质量分析（最大限制 15MB，跳过 HEIC/HEIF）。
- 相似照片哈希分组识别，以及基于匿名化 Photo-XXX 的 interactive A/B 比对比对决策。
- 数据与决策结果导出为 CSV/JSON 整理清单（原始文件名已脱敏）。

本方案旨在为下一阶段“物理整理与文件组织”提供清晰的分层防线，防止误操作、权限溢出或逻辑漏洞危及用户电脑上的照片资产安全。

---

## 2. 必须遵守的边界约束与“不做事项”

1. **原图绝对不变**：不论何时，原图文件（源目录）永远处于只读保护下，软件绝对不进行写回、修改、移动或删除操作。
2. **禁止直接删除**：近期以及未来开发阶段，严禁设计或实现任何“自动物理删除”或“一键清理原图”的功能，该事项不纳入路线图。
3. **禁止默认移动**：严禁在未经过充分验证的复制模式稳定前设计“移动（Move）”功能。
4. **禁止暴露物理路径**：前端 UI、导出 Manifest 及其报告、控制台 Console 等地方，严禁显示或输出任何真实绝对路径、盘符、Windows 用户名或敏感文件夹片段。
5. **限制 Tauri 权限**：不要申请 broad filesystem (`fs:allow-all`)、shell 等高危权限，必须使用作用域局限的目录授权或 Tauri standard capability。
6. **USE_SIGNAL_GROUPS_FOR_BATTLE 保持 false**：继续使用成熟 legacy 逻辑。

---

## 3. 物理整理安全分层 (Physical Org Layers)

### Layer 1：只读整理清单 (已完成)
- 仅支持导出 CSV / JSON 格式 of 元数据与决策清单。
- 文件名对 Native 自动脱敏为 `Photo-001` 等匿名名。
- 不执行任何物理文件复制或移动。

### Layer 2：用户可审查的操作计划 (设计中)
- 在用户确认执行物理操作前，生成一份可读但脱敏的操作计划。
- 展示计划复制的“保留照片”数量、“淘汰候选照片”数量，及预估占用的磁盘空间。
- 不展示文件的真实绝对路径与名称，仅展示 `Photo-001`、`Photo-002` 等匿名标识符。

### Layer 3：复制到新输出文件夹 (首期实现目标)
- **只复制，不移动，不删除**。
- 用户必须通过 Native folder picker 选择一个**全新且与源目录不同**的输出文件夹（在 UI 上展示为“已选择输出位置”等脱敏标签，不显示物理绝对路径）。
- 系统按分类在所选输出文件夹下自动创建子目录：
  - `<Selected Output Folder>/Keep/`（存放保留照片）
  - `<Selected Output Folder>/Cull-Candidates/`（存放淘汰候选照片）
  - `<Selected Output Folder>/manifest.json`（存放该批次整理的脱敏说明文件）
- 复制操作前必须执行 Dry-run 机制，且校验结果通过后方可启动复制。

### Layer 4：移动文件 (暂缓)
- 移动文件操作由于有导致原文件丢失的风险，在本期及近期规划中予以搁置。
- 必须在复制（Copy-only）模式运行足够长周期、无任何报错反馈后，再评估是否引入备份和二次确认移动。

### Layer 5：物理删除原图 (禁止实现)
- 严禁任何物理删除行为，产品定位为“整理与安全备份辅助”，不提供删除原图的逻辑与代码。

---

## 4. 核心安全机制设计

### 4.1 Dry-Run 机制 (先校验，后模拟)
所有物理复制开始前，必须自动执行一次 Dry-run 模拟检测，前端预览报告通过后方可解锁“开始复制”按钮。
Dry-run 校验流程：
1. **目标路径冲突检查**：检测输出文件夹中是否已有同名文件。若有冲突，设计冲突重命名解决预案，不直接覆盖已有文件。
2. **磁盘空间检查**：统计计划复制的照片文件总大小，与输出位置的磁盘可用空间比对。
3. **源文件可读性与完整性确认**：模拟读取原图文件状态，确保未被用户在外部手动改动。
4. **冲突解决策略**：若发生同名冲突，将目标文件名自动命名为 `Photo-XXX_conflict_[hash].[ext]`，绝不覆盖目标目录已有资产。

### 4.2 隐私隔离边界 (Native Bridge Barrier)
- 前端只与 Rust 传递脱敏的 `photoId`、`outputFolderToken` 和 `planId`，**绝对不传输任何真实的 source_folder、绝对路径或原始文件名**。
- 真实物理路径仅存在于 Rust 内部的会话映射 Map 中（`lib.rs` / 内存存储），绝对不向前端返回或暴露。
- 错误信息在 Rust 侧拦截脱敏，向前端统一返回类似 `[Err-102] 读取源文件失败` 的抽象代码，绝不携带 Windows 用户名或完整路径。
- 导出的 CSV/JSON 整理清单、复制结果报告以及控制台 Console，均不包含任何真实物理路径与真实文件名。

### 4.3 权限最小化与写入范围控制设计
- **当前阶段**：绝对不新增任何 Tauri 权限，保持 `core:default` 与 `dialog:allow-open` 的最小权限配置。不引入 `shell` 权限，不引入 `fs:allow-all` 或任何全局文件系统读写权限。
- **未来 Copy-only MVP 写入阶段**：
  - Dialog 只用于用户主动选择 output folder，不是写权限来源。copy-only 真实复制只由 Rust command 在内部基于 planId、outputFolderToken 与 canonical 校验执行；前端不获得文件系统写权限。
  - 写入范围严格受控于 Rust 侧。Rust 侧仅允许向用户指定的 `outputFolderToken` 对应目录进行写入。
  - 严禁任何由前端直接传入物理绝对路径去请求 Rust 侧写入的接口行为。
  - 严禁写回原图所在的 `source folder` 根目录下，且禁止 output folder 与 source folder 有任何层级交叉或重叠（例如：output folder 不能是 source folder 本身，不能是其子目录或父目录）。如果发生交叉，Rust 侧应立即中断并返回安全拒绝错误。

---

## 5. 数据结构草案 (Data Structures)

### 5.1 PhysicalOrgPlan (整理计划)
```typescript
interface PhysicalOrgPlan {
  planId: string;
  createdAt: number;
  mode: "copy-only";
  sourceSessionId: string;
  outputFolderToken: string; // 由 Rust 返回的脱敏输出文件夹临时 Token，而非绝对路径
  outputDisplayLabel: string; // 在 UI 展示的脱敏标签，例如: "已选择输出位置" 或 "输出位置 A"
  items: Array<{
    photoId: string;
    displayName: string; // 例如: "Photo-001"
    targetBucket: "keep" | "cull-candidate";
    targetRelativePath: string; // 例如: "Keep/Photo-001.jpg"
    status: "pending" | "skipped" | "planned" | "failed";
    reason?: string;
  }>;
}
```

### 5.2 PhysicalOrgDryRunResult (Dry-run 结果)
```typescript
interface PhysicalOrgDryRunResult {
  planId: string;
  totalItems: number;
  keepCount: number;
  cullCandidateCount: number;
  skippedCount: number;
  conflictCount: number;
  estimatedBytes: number;
  canProceed: boolean; // 是否符合执行标准
  warnings: string[];  // 例如: "目标磁盘空间不足", "发现 2 个文件已无法读取"
}
```

### 5.3 PhysicalOrgExecutionResult (执行结果)
```typescript
interface PhysicalOrgExecutionResult {
  planId: string;
  copiedCount: number;
  skippedCount: number;
  failedCount: number;
  reportItems: Array<{
    photoId: string;
    displayName: string;
    status: "success" | "skipped" | "failed";
    errorMsg?: string;
  }>;
}
```

---

## 6. Tauri Command 草案

```rust
// 让用户选择输出文件夹，返回脱敏 token 及用于展示的脱敏 display_label（如“已选择输出位置”）
// 不返回 basename，不返回物理绝对路径
#[tauri::command]
fn select_physical_org_output_folder() -> Result<(String, String), String>;

// 模拟当前的整理状态，生成脱敏的 dry-run plan 并返回模拟校验指标
// 前端不传入源文件夹 source_folder 的物理路径。Rust 侧通过 active folder 缓存与 photoId 映射自动定位物理文件并执行 canonical 校验
#[tauri::command]
fn create_physical_org_dry_run(
    output_token: String,
    decisions: Vec<(String, String)> // (photoId, bucket)
) -> Result<PhysicalOrgDryRunResult, String>;

// 仅执行 copy-only 操作，只接收 planId 且必须在 dry-run 通过后触发。不可覆盖，返回结果
#[tauri::command]
fn execute_physical_org_copy(plan_id: String) -> Result<PhysicalOrgExecutionResult, String>;

// 清理本会话的映射 Map 缓存，清除内存中的 token 和路径映射
#[tauri::command]
fn clear_physical_org_session() -> Result<(), String>;
```

---

## 7. UI 交互流程设计

在 Results 整理结果页面的 Sidebar 或操作区提供一个入口 **“本地整理输出”**：

```mermaid
graph TD
    A[点击 "本地整理输出"] --> B[Step 1: 选择输出文件夹]
    B --> C[Step 2: 系统运行 Dry-run 计划模拟]
    C --> D{Dry-run 成功?}
    D -- 否 --> E[展示警告/阻断错误, 允许重新选择或排查]
    D -- 是 --> F[Step 3: 预览脱敏整理计划及空间报告]
    F --> G[Step 4: 用户手动确认，开始复制]
    G --> H[展示串行复制进度条]
    H --> I[Step 5: 复制完成，生成脱敏结果报告]
```

*文案约束*：
- 统一使用 **“本地整理输出”**、**“复制到新文件夹”**、**“原图保持不变”**。
- 输出文件夹显示标签使用 **“已选择输出位置”** 或 **“本地输出位置”** 等脱敏文案，绝不显示 Windows 用户名、路径或 basename。
- 绝不允许使用 “物理删除”、“清理废片” 或任何提及物理修改原图的词汇。

---

## 8. 下一步验证与验收标准

在下一阶段实现 MVP 时，验收应达到：
1. 物理复制后，源文件夹内的图片绝对没有数量或哈希的改变。
2. 目标输出文件夹中成功建立 `Keep/` 与 `Cull-Candidates/` 分类，且图片可正常加载。
3. 复制逻辑串行推进，出现冲突或重名时自动安全命名。
4. 真实绝对路径、源盘符和敏感段不进入 manifest、report 以及 console.error 输出。
