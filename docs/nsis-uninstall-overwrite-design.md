# NSIS 卸载与覆盖安装流程设计方案：CORE-DESKTOP-NATIVE-NSIS-UNINSTALL-OVERWRITE-DESIGN-1

## 1. 背景与问题描述

在 AI Photo Cleaner 桌面端（Native）打包测试中，用户在双击运行 NSIS 安装包（`AI Photo Cleaner_0.1.0_x64-setup.exe`）并尝试卸载或覆盖安装时，遇到了以下非预期行为：
- **核心现象**：执行卸载流程结束后，系统没有关闭安装器窗口并正常退出，而是直接又开始自动进入安装流程。
- **用户预期**：
  1. 用户通过 **Windows 设置 -> 应用 -> 安装的应用** 或 **控制面板** 卸载时，卸载完成后应彻底结束并关闭窗口，绝不能自动拉起安装程序。
  2. 用户双击运行同一个 `setup.exe` 覆盖安装或更新时，应明确提示是覆盖安装/修复/重新安装，而不是在执行完旧版本卸载后，在不经用户二次确认的情况下直接静默开始全新安装，甚至误触发卸载与安装的死循环。

本方案旨在通过只读审计 Tauri v2 的打包配置，分析导致此现象的深层原因，设计一套完全依托 Tauri 官方配置及 NSIS 脚本规范的安全修复方案。

---

## 2. 当前 Tauri / NSIS 配置诊断

通过对项目根目录及 `src-tauri` 下核心配置文件的审计，诊断如下：

1. **基本字段审计** (`src-tauri/tauri.conf.json`)：
   - `productName`: `"AI Photo Cleaner"` —— 包含空格的正式品牌名称。
   - `identifier`: `"com.aiphotocleaner.app"` —— 已从默认的 `com.tauri.dev` 修正为合规的唯一标识符。
   - `version`: `"0.1.0"` —— 语义化版本号。
2. **打包目标审计**：
   - `"targets": "all"` —— 编译时会同时在 `src-tauri/target/release/bundle/` 下生成 `.msi` (WiX) 和 `-setup.exe` (NSIS) 两种格式。
3. **NSIS 特定配置审计**：
   - 当前 `tauri.conf.json` 的 `"bundle"` 下**不存在** `"nsis"` 配置块。
   - 项目**完全使用 Tauri 默认的 NSIS 模板与内置逻辑**进行打包。
   - 未指定任何自定义 NSIS 模板（`template` 字段为空）。
   - 未指定任何安装器钩子（`installerHooks` 字段为空）。
   - 未配置 `installMode`，因此默认采用 `perUser` 模式（安装至 `%LOCALAPPDATA%`，无需管理员权限）。

---

## 3. 问题根源分析 (可能原因)

结合 Tauri 源码与 Windows 系统的底层行为，定位以下可能导致“卸载完后又自动安装”的原因：

### 原因 A：同一个 `setup.exe` 在已安装状态下被双击运行，执行了旧版本卸载并自动继续安装 (核心原因)
Tauri 默认生成的 NSIS 脚本包含一个预设机制：**当用户运行 `setup.exe` 且检测到系统已存在旧版本时，安装器会调用旧版本的 `uninstall.exe` 进行清理，并在卸载完成后，继续执行新版本的安装逻辑。**
- **逻辑盲区**：如果用户双击运行 `setup.exe` 的本意是想通过它来“卸载”软件，那么当他点击“卸载现有版本”后，安装器在执行完卸载后并不会退出，而是会继续执行安装，导致用户产生“卸载完了为什么又装上了”的困惑。

### 原因 B：NSIS 默认重装页面（`PageReinstall`）在卸载分支中缺少 `Quit` 指令
在默认的 NSIS 重装逻辑中：
1. 检测到已安装版本后，会弹出提示页面（如“已存在旧版本，是否先卸载？”）。
2. 用户选择“是”并触发 `ExecWait '"$INSTDIR\uninstall.exe" ...'` 执行卸载。
3. 卸载程序运行并成功删除了程序文件。
4. **关键缺陷**：卸载进程结束后，主安装包 `setup.exe` 并没有调用 `Abort` 或 `Quit` 退出，而是继续向下执行下一阶段的 `PageInstFiles`（安装文件复制阶段），导致重新安装。

### 原因 C：Windows 应用兼容性助手 (Application Compatibility Assistant - ACA) 误判
由于当前生成的 `uninstall.exe` 是临时编译且**未进行代码签名 (Unsigned)**：
1. 当用户从控制面板卸载时，`uninstall.exe` 运行并删除自身及安装目录。
2. 卸载完成后，Windows ACA 可能会检测到未签名程序的卸载行为，并误认为“程序可能未正确卸载”。
3. ACA 会弹出系统级提示：“此程序可能未正确卸载，是否重新安装？”。如果用户误点击，系统将自动重新运行临时缓存的安装包。

### 原因 D：MSI 与 NSIS 重叠安装导致注册表混乱
如果测试人员在同一台机器上交叉安装了 MSI 版本和 NSIS 版本：
1. 它们可能注册了相同的 `productName` 和不同的 `Uninstall` 注册表项。
2. 在控制面板中点击卸载时，可能会错误调用另一个版本的卸载/维护逻辑，导致卸载完 NSIS 后，MSI 判定配置受损并自动触发“自愈/修复 (Self-healing)”重新安装。

---

## 4. 推荐修复方案

为了从根本上解决卸载循环，同时不影响 MSI 且不新增运行时权限，推荐采用以下递进式修复方案：

### 方案一：升级 Tauri 的 NSIS 配置，指定 `installMode` 与 `displayLanguageSelector` (首选，最安全)
首先在 `tauri.conf.json` 中显式定义 NSIS 的行为，约束安装范围，防止因虚拟化导致的注册表混乱。

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "windows": {
      "nsis": {
        "installMode": "perUser",
        "displayLanguageSelector": true,
        "compression": "lzma"
      }
    }
  }
}
```
*注：通过固化 `perUser`，确保卸载和安装路径都严格处于 `%LOCALAPPDATA%` 下，无需管理员权限，避免 UAC 虚拟化对注册表的干扰。*

### 方案二：编写轻量级 NSIS 钩子脚本（`installerHooks`）控制卸载行为 (推荐)
Tauri 支持在不重写整个 `installer.nsi` 的情况下，通过 `installerHooks` 注入自定义 `.nsh` 脚本。我们可以利用 `NSIS_HOOK_PREUNINSTALL` 或 `NSIS_HOOK_PREINSTALL` 钩子，优雅地控制流程。

1. **配置 `tauri.conf.json`**：
   ```json
   "nsis": {
     "installerHooks": "./nsis-hooks.nsh"
   }
   ```
2. **编写 `nsis-hooks.nsh`**：
   通过钩子判断当前执行上下文。如果是旧版本卸载逻辑，在执行完 `uninstall.exe` 后，立即强制主安装进程终止（调用 `Quit` 或 `Abort`），不给其继续安装的机会。
   *(设计细节将在后续实现阶段进行详细脚本编写。)*

### 方案三：采用官方标准的“卸载/维护模式 (Maintenance Mode)”改造 (进阶)
如果默认的 PageReinstall 逻辑不能满足需求，需要自定义 NSIS 模板（`template: "./custom-installer.nsi"`）。
- 在检测到已安装同名软件时，弹出包含三个单选按钮的对话框：
  - [ ] **更新/覆盖安装 (Upgrade/Overwrite)**：保留数据，覆盖二进制文件。
  - [ ] **修复安装 (Repair/Reinstall)**：重新写入所有文件。
  - [ ] **彻底卸载 (Uninstall/Remove)**：调用卸载逻辑，卸载完成后**必须执行 `Quit` 终止当前安装器**。

---

## 5. 不推荐方案 (红线警示)

为保障系统与用户数据安全，以下方案**严禁采用**：
1. **🚫 严禁在应用业务代码中调用系统命令自删除**：不要在 React/TypeScript 或 Rust 逻辑中编写杀死自身进程并删除安装目录的代码。安装与卸载属于系统级动作，必须由安装器（NSIS/MSI）管理。
2. **🚫 严禁越权删除用户数据**：卸载程序只能清除安装释放的程序文件、快捷方式和特定注册表项，**绝不能**递归删除用户的照片目录或临时导出的整理目录。
3. **🚫 严禁修改全局环境变量**：不应为了实现卸载而向 Windows System 注册表写入危险的全局启动项或修改全局 PATH。

---

## 6. 实施边界

1. **只在 Windows 构建管道生效**：所有的 NSIS 修改仅作用于 `src-tauri/tauri.conf.json` 的 `"windows"` 子项，绝不影响 Mac/Linux 打包。
2. **不影响 MSI 逻辑**：MSI 包由 WiX 工具集编译，其升级与卸载逻辑由 Windows Installer 服务天然保障。本方案的修改应局限在 NSIS 范围内，确保 MSI 的构建和稳定性不受干扰。
3. **保持应用“零联网”与“本地化”**：安装器不应尝试联网检测更新，依然保持 100% 离线隐私安全。

---

## 7. 验收测试清单 (Acceptance Test Checklist)

后续实现完成后，必须在干净的虚拟机（如 Windows Sandbox）中依次执行以下测试用例：

| 测试用例 ID | 测试场景 | 操作步骤 | 预期结果 |
| :--- | :--- | :--- | :--- |
| **TC-01** | **全新安装** | 在未安装本软件的干净系统上，运行 `setup.exe`。 | 正常显示安装向导，安装完成后快捷方式正常，App 可打开。 |
| **TC-02** | **覆盖安装 (同版本)** | 在已安装 0.1.0 状态下，再次双击 `setup.exe`。 | 界面应明确提示“已安装此版本”，并提供“修复/重新安装”选项。选择后不应产生循环。 |
| **TC-03** | **Windows Apps 卸载** | 从 Windows 设置 -> 应用 -> 安装的应用中点击“卸载”。 | 卸载进程运行，完成后窗口自动关闭，应用完全移除，**绝不拉起安装程序**。 |
| **TC-04** | **setup.exe 维护卸载** | 双击 `setup.exe`，在弹出的重装界面中选择“卸载/移除旧版本”。 | 卸载执行完毕后，主安装器窗口应**立即退出并关闭**，不应继续进行新一轮安装。 |
| **TC-05** | **MSI 对照测试** | 运行 `AI Photo Cleaner_0.1.0_x64_en-US.msi` 进行安装与卸载。 | MSI 流程表现稳定，卸载后无残留，不触发自愈安装。验证若 MSI 极其稳定，可在 Alpha 阶段作为首选。 |
| **TC-06** | **卸载后全新安装** | 执行完全卸载后，再次双击 `setup.exe`。 | 应判定为“未安装”状态，直接进入 TC-01 的全新安装向导。 |

---

## 8. 后续实现 Checkpoint 建议

本方案审核通过后，建议按照以下 checkpoint 分步实施：

1. **Checkpoint 1: NSIS Configuration & Hook Setup**
   - 在 `tauri.conf.json` 中配置 `"nsis"` 相关参数。
   - 编写 `nsis-hooks.nsh`，注入中止旧版本重装的逻辑。
2. **Checkpoint 2: Local Packaging & Installation Verification**
   - 运行 `npm run desktop:build` 编译新安装包。
   - 在 Windows Sandbox 运行回归测试，验证 TC-03 与 TC-04。
3. **Checkpoint 3: MSI Release Evaluation**
   - 评估在未获取付费代码签名证书前，是否将 MSI 作为内部测试的首选分发格式（MSI 在未经签名时的 SmartScreen 拦截机制相对 NSIS 更温和，且卸载逻辑天然闭环）。
