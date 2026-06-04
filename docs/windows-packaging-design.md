# Windows 桌面端打包与安装包设计规划：CORE-DESKTOP-NATIVE-WINDOWS-PACKAGING-DESIGN-1

## 1. 背景
AI Photo Cleaner 桌面端（Native）当前已稳定支持最大 200 张照片的串行读取与分析，并且在取消机制、物理复制整理 (Copy-Only)、`report.json` 脱敏以及隐私数据本地化处理上完成了核心安全演进。随着功能在开发与热重载环境下的稳定，为了让普通 Windows 用户可以一键安装并便捷运行，我们需要在保证现有安全边界不退化的前提下，对 Windows 打包格式、安装器方案、代码签名、发布 QA 清单及发布命名规则进行详尽的打包与安装包设计。

本轮工作**只做打包与安装包方案设计，不修改产品逻辑，不新增 Tauri 权限，不真正编译安装包**。本设计将作为后续打包实施阶段的技术规范。

## 2. 当前稳定基线
- **核心限额**：
  - Native 预览扫描最大限制为 200 张。
  - Native 核心分析最大限制为 200 张。
- **处理模式**：
  - 坚持完全单队列串行读取与分析（queue depth = 1），无并发读取，单张 15MB 限制，HEIC/HEIF 扩展名跳过。
- **取消与数据保留**：
  - 支持中途打断分析，打断后已分析结果保留，未分析照片标记跳过并保持默认 `keep`。
- **整理输出安全**：
  - Copy-Only 物理复制，将照片拷贝到导出会话 session 子文件夹下，同名文件自动重命名规避。
  - 禁止进行任何 physical `move`、`delete` 或 `overwrite`，绝不改动用户源照片。
  - `report.json` 导出内容进行脱敏处理，UI 隐藏绝对路径。
- **权限与本地化**：
  - 最小化 Tauri 权限隔离（仅授权 dialog 用于目录选择）。
  - 零联网，不与 Supabase、OpenAI API 联网后端依赖，默认 100% 本地离线处理。

## 3. Windows 打包目标与安装包类型选择
针对 Windows 桌面端，设计以下打包产物与分发目标：

### 3.1 产物目标
- **Tauri 开发热重载版**：通过 `npm.cmd run desktop:dev` 运行，仅供开发人员在代码变动时进行快速调试与排障。
- **本地测试可安装包**：通过 `npm.cmd run desktop:build` 在本地生成未签名的临时安装包，用于局域网或虚拟机测试。
- **便携单文件版 (Portable)**：
  - 直接输出单文件 `.exe` 可执行程序，用户双击直接启动运行。
  - **优势**：免安装、即开即用、零注册表与系统目录污染，非常适合注重隐私和系统纯净度的高级用户。
- **正式发布包 (Installer)**：
  - 提供标准的 Windows 安装引导程序。

### 3.2 安装包格式选择 (MSI vs NSIS)
- **MSI 格式 (Windows Installer)**：
  - **特点**：结构规范，易于在企业环境中通过组策略 (GPO) 进行静默分发和集中部署。
  - **痛点**：安装界面死板，包体积相对较大，对普通消费级用户安装不够友好。
- **NSIS 格式 (Nullsoft Scriptable Install System)**：
  - **特点**：Tauri v2 支持通过 NSIS 构建 `.exe` 安装程序。其压缩算法极其优秀，生成的安装包体积更小、安装速度快，且支持丰富的自定义安装引导界面（如自定义安装路径、创建桌面快捷方式等）。
  - **推荐方案**：**对于普通大众用户，正式发布包首选 NSIS (exe) 格式**。对于企业部署用户，可并行输出 MSI 格式。

### 3.3 代码签名规划与用户提示规避
- **未签名安装包的风险**：
  - 若安装包未进行代码签名，Windows Defender SmartScreen 将在用户双击运行时强制弹窗拦截：“Windows 保护了您的电脑：Windows SmartScreen 已阻止启动一个未识别的应用...”，用户必须点击“更多信息” -> “仍要运行”方能安装。
  - 360 安全卫士、腾讯电脑管家等报毒拦截：未签名且未提交白名单认证的 Rust/Tauri 二进制程序极其容易被杀毒软件误报为未知木马。
- **代码签名方案**：
  - 在 Alpha 阶段，优先提供未签名便携版并附带“SmartScreen 信任说明文档”，或让用户在 Sandbox 环境运行。
  - 在进入公开发布 (Release) 时，**必须获取合规的 Windows 代码签名证书**（如购买 Sectigo 或 DigiCert EV 证书），在打包流程中对打包的 exe/msi 进行签名。
  - 积极向微软安全中心提交二进制白名单申请，以消除杀毒软件误报。

## 4. 隐私与权限说明
在安装引导界面、产品关于 (About) 页面以及官网下载页上，必须加粗声明并解释以下隐私安全设计：
- **100% 离线与本地化处理**：默认纯本地计算，软件中无账号注册、无登录要求，绝不上传您的任何原图或分析数据至任何服务器。
- **绝不破坏原图**：软件的“淘汰建议”仅供参考。在整个读取和整理流程中，绝对不物理删除、不物理移动、不修改您的原图，源文件夹保持只读状态。
- **Copy-Only 隔离整理**：整理照片仅通过纯复制（Copy-Only）输出至您指定的全新文件夹，原图毫发无损。
- **随附报告安全脱敏**：随照片复制一同生成的 `report.json` 已做彻底的脱敏处理，绝不记录真实的绝对路径、真实文件名以及计算机用户名。
- **文件夹选择即授权**：软件仅在您主动使用 Dialog 选择特定相册目录时，才临时申请该特定相册的只读访问授权，退出软件后授权即时失效，不残留任何后台系统服务，不申请全局相册权限。

## 5. Tauri 安全边界
发布包中必须严格约束并固化以下安全规范，任何打包优化**不得越过以下红线**：
- **禁止扩权**：禁止在 `capabilities/default.json` 或 `tauri.conf.json` 中配置任何广域文件系统访问权限，禁止开启 `fs:allow-all`、`shell:allow-all`、广域 `shell` 插件。
- **禁止开启 assetProtocol**：必须保持安全防护 `"assetProtocol": { "enable": false }`，杜绝前端恶意脚本直接读取系统任意物理路径资产。
- **禁止后台常驻与开机启动**：不添加系统服务，不添加开机自启动逻辑，退出软件后内存资源完全退还系统。
- **禁止隐私收集与遥测**：不引入任何联网遥测、追踪、广告接入及数据分析埋点。
- **禁止联网 AI**：不接入 Supabase、OpenAI API 联网后端，防止泄漏用户本地照片内容。
- **自动更新安全策略**：本阶段不启用自动更新。未来如启用自动更新，必须通过安全签名的 updater 方案，并在下载完成后校验签名指纹，防范 DNS 劫持和中间人劫持恶意静默更新。

## 6. 发布前 QA 清单 (Pre-release Checklist)
在每次生成发布包前，必须严格依次执行并确认以下 QA 检查：

### 6.1 静态与编译命令校验
- [ ] 运行 `git status --short` 确认工作区干净，无未跟踪文件（发布用包需确保工作区无任何未提交的代码修改）。
- [ ] 运行 `git diff -- src/lib/config/featureFlags.ts` 确认 feature flags 与预期一致。
- [ ] 运行 `npm.cmd run build` 确保前端成功进行生产环境编译打包。
- [ ] 运行 `npm.cmd run lint` 确认前端类型与规范无警告/报错。
- [ ] 运行 `npm.cmd run desktop:dev` 确认 Tauri 调试开发环境可以成功拉起窗口并正确重载。
- [ ] 运行 `cargo check` 确认 Rust 底层无编译警告与依赖报错。
- [ ] 运行 `npx tauri build` 确保 Tauri 生产级打包流程顺利完成，成功生成 msi / exe 产物。

### 6.2 安装与运行测试
- [ ] **Windows 安装测试**：双击生成的安装包（MSI/NSIS），验证默认安装路径（如 `%LOCALAPPDATA%`）是否正确，快捷方式和开始菜单图标是否正常拉起。
- [ ] **卸载测试**：通过控制面板或开始菜单执行“卸载”，确认安装目录及所有释放的文件彻底清除，无任何多余文件夹残留，不影响用户本地数据。
- [ ] **重新安装测试**：先卸载再重新安装，验证软件依然能正常运行，确认无残留配置导致重装闪退。

### 6.3 规模分级压测回归
- [ ] **30 张流程**：本地预览、本地分析、Results、Similar Groups、A-B 对决正常，Native ZIP 禁用拦截有效。
- [ ] **50 张流程**：各功能模块运行流畅，无内存抖动。
- [ ] **100 张流程**：常规上限规模下性能平稳，无 OOM。
- [ ] **200 张 Native 流程**：测试 200 张真实高分 JPG，确认分阶段 GC 窗口（休眠出让时间片）有效工作，物理内存波峰平稳不崩溃。
- [ ] **220 / 250 张截断**：验证超出 200 张的文件夹，系统仅处理前 200 张，多余照片直接安全忽略，系统不全量扫描，且不崩溃。

### 6.4 异常流与中断测试
- [ ] **停止分析**：在 200 张分析的中途（如第 50 张、120 张时）点击“停止分析”，确认当前单图分析完后安全中断，已分析结果保留，未分析照片标记为 skipped 且不进入淘汰候选，不自动开启后续流程。
- [ ] **异常与跳过测试**：文件夹混入损坏图片、HEIC/HEIF 图片、>15MB 超大图，验证系统是否能够优雅跳过 HEIC 和超大图，损坏图标记失败，整体分析不卡顿。

### 6.5 功能模块回归
- [ ] **Results**：确认 200 张或部分取消后的结果页可正常显示、滚动、统计。
- [ ] **Similar Groups**：确认用户手动触发后正常识别，不自动启动。
- [ ] **A/B**：确认用户手动触发后 Photo Battle 正常，不自动启动。
- [ ] **copy-only physical org**：确认物理整理正常，session 目录创建、同名规避生效。
- [ ] **report.json 脱敏**：检查导出的 report.json，确认不包含任何真实的物理路径、真实文件名、photoId/sourceId/previewUrl/basename/originalName，完全实现脱敏。
- [ ] **Native ZIP 禁用**：确认本地模式下的 ZIP 导出按钮确实被安全置灰与禁用。

### 6.6 Web / Demo 端回归
- [ ] **Web upload**：验证网页端的上传正常。
- [ ] **Web Results**：验证网页端的结果页呈现正常。
- [ ] **Web ZIP / CSV / JSON**：验证网页端的 ZIP 导出、CSV 及 JSON 清单下载正常。
- [ ] **Demo Similar Groups**：验证演示项目的相似重复组正常。
- [ ] **Demo A/B**：验证演示项目的 AB 对局流程正常，Web/Demo 端不误显示 Native 特有的本地整理输出入口。

## 7. 安装与卸载测试策略
打包完成后，必须在干净的虚拟机（如全新 Windows Sandbox 或全新安装的 Windows VM）中进行以下系统级安装测试：
- **安装测试**：
  - 双击安装包，验证默认安装路径（通常是 `%LOCALAPPDATA%` 或 `Program Files`）是否正确。
  - 确认桌面快捷方式、开始菜单图标能够成功创建且点击正常拉起软件。
- **卸载测试**：
  - 通过控制面板或开始菜单执行“卸载”。
  - 确认卸载流程能彻底移除安装目录及所有释放的文件，没有多余的空文件夹残留。
  - 验证卸载是否会误删除任何用户自己本地的数据，确保卸载过程百分百安全。
- **重装与覆盖测试**：
  - 覆盖安装：在已安装低版本的前提下，双击新版本安装包，确认能平滑覆盖升级而不提示冲突。
  - 卸载后重装：先卸载再重新安装，验证软件依然能正常运行，确认无残留的坏锁配置文件导致重装后闪退。

## 8. 版本号与发布命名
- **当前阶段定位**：虽然 200 张批量限制已通过本地验证，但在缺少代码签名与广泛兼容性验证前，定义为 `Alpha` (内部封测版) 或者是 `Beta` (公开测试版)。
- **版本号规则**：
  - 遵循语义化版本号 (SemVer) 规范。
  - 当前包基础版本号为 `0.1.0`。
  - 测试版推荐使用：`0.1.0-alpha.1` 或是 `0.1.0-beta.1`。
- **安装包命名规范**：
  - **NSIS 安装包**：`AI_Photo_Cleaner_v{Version}_windows_{Arch}_installer.exe`
    - 示例：`AI_Photo_Cleaner_v0.1.0-alpha.1_windows_x64_installer.exe`
  - **便携版产物**：`AI_Photo_Cleaner_v{Version}_windows_{Arch}_portable.exe`
    - 示例：`AI_Photo_Cleaner_v0.1.0-alpha.1_windows_x64_portable.exe`
- **Changelog 与 Release Notes 维护**：
  - 每次发布在根目录下维护 `CHANGELOG.md`，记录代码修改明细。
  - 编写用户可见的 `Release Notes`，着重陈述新版本改进与 100% 本地隐私安全。

## 9. 后续实现拆分 (Packaging Milestones)
后续的打包实现与测试过程拆分为以下 4 个 Checkpoint：

- **Checkpoint A：Build configuration audit (构建配置审计)**
  - 只检查当前 Tauri 资源包配置、图标等，不修改产品逻辑。
  - 优化 `tauri.conf.json` 中的标识符等基本字段。
  - 输出打包命令和风险清单。
- **Checkpoint B：Local Tauri packaging (本地构建验证)**
  - 在本地运行 `npm run desktop:build` 或 `npx tauri build`，验证 Rust 生产级编译与二进制压缩。
  - 验证便携版与 NSIS 可安装包在本地的成功输出，不进行公开发布。
- **Checkpoint C：Installation and sandboxing verification (安装/卸载及边界隔离测试)**
  - 在干净 of Windows 沙盒中进行安装测试，确认无残留。
  - 进行 200 张满载分析性能压测，确认 GC 窗口正常工作。
  - 检验 Copy-Only 的安全限制与 report.json 脱敏，防止路径和文件写入污染。
- **Checkpoint D：Release assets preparation (发布资源包准备)**
  - 整理 changelog 与 release notes。
  - 撰写官网下载页或文档的隐私声明、权限最小化说明文案，准备发布。

## 10. 推荐下一 Checkpoint
- `CORE-DESKTOP-NATIVE-WINDOWS-PACKAGING-A` (构建配置审计，审计 `tauri.conf.json` 配置、图标资源完备性并准备打包环境，不改动产品代码)。

## 11. 打包配置修正记录 (CORE-DESKTOP-NATIVE-WINDOWS-PACKAGING-CONFIG-FIX-1)
- **Tauri Identifier 修正**：已将 `identifier` 从 `com.tauri.dev` 修正为 `com.aiphotocleaner.app`。
- **Product Name 调整**：已将 `productName` 从 `ai-photo-cleaner` 调整为用户可见品牌名 `AI Photo Cleaner`。
- **发布状态**：当前仍是 internal alpha，本轮不公开发布。
- **后续待完善事项**：在正式公开发布前，仍需要解决代码签名（Code Signing）、完善发行商/版权信息（Publisher/Copyright）、以及优化 installer 的安装流程 and 细节。

## 12. 静态导出与打包修复记录 (CORE-DESKTOP-NATIVE-WINDOWS-PACKAGING-EXPORT-FIX-1)
- **静态导出要求**：Tauri 构建需要 Next.js static export 输出至 `out` 目录。
- **配置项启用**：已在 `next.config.mjs` 中启用 `output: 'export'` 并配置 `images: { unoptimized: true }`，确保 `npm run build` 正确生成静态 `out` 目录且解决 `next/image` 兼容问题。
- **打包结果**：`npm run desktop:build` 成功构建完成。
- **安装包输出目录**：`src-tauri/target/release/bundle/`
- **生成安装包产物**：
  - MSI 格式：`src-tauri/target/release/bundle/msi/AI Photo Cleaner_0.1.0_x64_en-US.msi` (大小：3,760,128 字节，约 3.59 MB)
  - NSIS (EXE) 格式：`src-tauri/target/release/bundle/nsis/AI Photo Cleaner_0.1.0_x64-setup.exe` (大小：2,710,091 字节，约 2.58 MB)
- **签名与安全警示**：产物当前为未签名状态（Unsigned），双击运行时会触发 Windows Defender SmartScreen 拦截与风险警告。本轮仅用于本机与虚拟机隔离测试，不公开发布。

