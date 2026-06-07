# NSIS 维护与重装流程最小化模板修改设计：CORE-DESKTOP-NATIVE-NSIS-MAINTENANCE-FLOW-TEMPLATE-DIFF-QA-LITE-1

## 1. 默认 NSIS 模板来源与定位

在 Tauri v2 的打包体系中，底层的打包工作由 `cargo-packager` 接管。默认的 NSIS 模板 `installer.nsi` 并非静态存在于用户目录中，而是在构建时由 Tauri CLI 动态生成。
- **本地临时渲染文件**：当前项目在执行构建后，已渲染的模板临时缓存在：
  [installer.nsi](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src-tauri/target/release/nsis/x64/installer.nsi)
- **原始模板来源**：
  若要实现自定义模板，我们需要获取包含 Handlebars 变量占位符（例如 `{{product_name}}`）的原始模板文件。该模板可从对应版本的 `cargo-packager` 官方 GitHub 仓库中提取（路径通常为 `crates/packager/src/package/nsis/installer.nsi`）。

---

## 2. 关键函数与页面逻辑分析

在已渲染的 `installer.nsi` 中，维护和重装逻辑核心由以下部分驱动：

### 2.1 注册表检测与版本对比
在 `PageReinstall` 函数中，安装包会查询 `Uninstall` 注册表键值，并使用 `nsis_tauri_utils::SemverCompare` 对比当前安装包版本与已安装版本：
- 同版本：设置变量 `$R0 = 0`。
- 升级：设置变量 `$R0 = 1`。
- 降级：设置变量 `$R0 = -1`。

### 2.2 维护页面单选按钮设置
在 `PageReinstall` 页面渲染中，会根据 `$R0` 的值在界面上显示两个单选按钮（RadioButtons）：
- **如果同版本 ($R0 = 0)**：
  - 第一个按钮（`$R2`）：`$(addOrReinstall)`（重新安装/修复）。
  - 第二个按钮（`$R3`）：`$(uninstallApp)`（仅卸载）。
- **如果升级或降级 ($R0 = 1 / -1)**：
  - 第一个按钮（`$R2`）：`$(uninstallBeforeInstalling)`（安装前先卸载）。
  - 第二个按钮（`$R3`）：`$(dontUninstall)`（不卸载直接覆盖）。

### 2.3 卸载执行与后续流转 (`PageLeaveReinstall`)
当用户点击“下一步”时，触发 `PageLeaveReinstall` 函数：
1. **读取状态**：读取第一个按钮的值 `$R1`（`1` 表示选中首选，`0` 表示选中次选即 `uninstallApp`）。
2. **路由分配**：
   - 如果用户选择的是“卸载”分支，逻辑会跳转到 `reinst_uninstall` 标号。
   - `reinst_uninstall` 执行 `ExecWait` 调用旧版卸载器：
     `ExecWait '$R1 _?=$4' $0` （其中 `$R1` 为卸载器路径，`$0` 为退出码）。
3. **缺陷暴露**：卸载完成后，如果 `$0 = 0`（成功），逻辑直接流向 `reinst_done`。函数执行完毕后，主安装器进程 `setup.exe` 并不退出，而是继续执行后面的 `MUI_PAGE_DIRECTORY`（目录选择）和 `MUI_PAGE_INSTFILES`（安装文件复制），导致了非预期的“卸载后重新安装”。

---

## 3. 最小 Diff 设计方案

为实现“选择仅卸载时卸载完成后安全退出，选择覆盖安装时继续安装”的目标，对 `PageLeaveReinstall` 进行最小化改动设计：

### 3.1 修改逻辑伪代码描述
在 `PageLeaveReinstall` 函数的 `reinst_uninstall` 分支末尾，即执行完 `ExecWait` 并通过所有错误校验（即判定卸载彻底成功）之后，加入如下控制分支：

```nsis
# 如果原装版本是同版本（$R0 = 0），且用户选择了第二个单选按钮“仅卸载”（即 $R1 = 0）
${If} $R0 = 0
${AndIf} $R1 = 0
  # 主安装器进程 setup.exe 立即安全退出，不进入后续页面
  Quit
${EndIf}
```

### 3.2 最小 Diff 示意
修改位置位于 `PageLeaveReinstall` 函数的 `reinst_uninstall:` 标号底部，`reinst_done:` 标号之前：

```diff
     ${If} $0 <> 0
     ${OrIf} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
       ; User cancelled wix uninstaller? return to select un/reinstall page
       ${If} $WixMode = 1
       ${AndIf} $0 = 1602
         Abort
       ${EndIf}
 
       ; User cancelled NSIS uninstaller? return to select un/reinstall page
       ${If} $0 = 1
         Abort
       ${EndIf}
 
       ; Other errors? show generic error message and return to select un/reinstall page
       MessageBox MB_ICONEXCLAMATION "$(unableToUninstall)"
       Abort
     ${EndIf}
+
+    ; 如果是同版本维护模式下的“仅卸载”分支，卸载成功后主安装包直接退出，不继续执行安装
+    ${If} $R0 = 0
+    ${AndIf} $R1 = 0
+      Quit
+    ${EndIf}
+
   reinst_done:
 FunctionEnd
```

---

## 4. 关键分支与风险控制

为防止影响正常安装，该设计严格限定了 `Quit` 的作用范围：

### 4.1 绝对不应执行 Quit 的分支 (必须保持安装)
- **全新安装**：未检测到旧版本时，`PageReinstall` 页面被提前 `Abort` 跳过，不经过 `PageLeaveReinstall`，绝对不会触发 `Quit`。
- **升级安装 ($R0 = 1)**：无论用户选择“安装前卸载”还是“不卸载直接覆盖”，目的都是装入新版本，此时 `$R0 != 0`，绝对不会触发 `Quit`，安装顺利进行。
- **降级安装 ($R0 = -1)**：逻辑同升级，确保用户可以顺利降级覆盖，绝对不触发 `Quit`。
- **维护模式下的“重新安装” ($R0 = 0, $R1 = 1)**：用户主动选择 `addOrReinstall`，意图是修复安装，逻辑直接跳到 `reinst_done` 并不经过 `reinst_uninstall`，绝对不触发 `Quit`。
- **用户中途取消卸载**：当卸载器被用户取消（`$0 = 1` 或 `1602`）时，执行 `Abort` 回退页面，不会触发 `Quit`。

### 4.2 避免影响 Windows Apps / Settings 卸载
- Windows Apps 卸载直接调用安装在本地的 `uninstall.exe`，不经过 `setup.exe`。
- `uninstall.exe` 本身不包含 `PageLeaveReinstall` 逻辑，因此该修改对系统自带的卸载入口毫无影响。

---

## 5. 后续 tauri.conf.json 接入设计

本设计在后续实现阶段，将通过以下步骤引入项目中：
1. 从 `cargo-packager` 提取原始的 `installer.nsi` 并命名为 `src-tauri/my-installer.nsi`。
2. 将上述最小 Diff 修改手工合入 `src-tauri/my-installer.nsi`。
3. 修改 `src-tauri/tauri.conf.json`，在 `bundle > windows > nsis` 下指向该自定义模板：
   ```json
   {
     "bundle": {
       "windows": {
         "nsis": {
           "template": "./my-installer.nsi"
         }
       }
     }
   }
   ```

---

## 6. 风险分析

### 6.1 高风险点
- **重装分支误杀**：如果 Quit 判定逻辑写错（例如没有检查 `$R1 = 0`），会导致用户想要“修复/重装”同版本时，安装器在删掉旧版后直接退出，导致软件损坏且无法装回。
- **全新安装误杀**：如果 `Quit` 没有被严格限定在 `PageLeaveReinstall` 内部的 `reinst_uninstall` 结束处，可能会干扰全新安装逻辑。
- **升级路径漂移**：Tauri 未来升级其 bundler 版本时，可能会更改默认 `installer.nsi` 模板中的变量名或宏定义，导致项目自定义的 `my-installer.nsi` 产生语法冲突而无法通过编译。
  - *规避措施*：仅在打包阶段使用自定义模板，升级 Tauri 时必须重新对比官方模板。

### 6.2 中/低风险点
- **卸载文案歧义**：默认的单选框文案 `$(uninstallApp)`（卸载）和 `$(addOrReinstall)`（添加或重装）需在非英文环境下做好汉化与多语言配置，确保用户不易产生歧义。
- **未签名拦截**：临时编译的自定义包在测试时依然会触发 SmartScreen，需在虚拟机中排除警示进行验证。

---

## 7. 验收测试清单

后续完成实现后，必须在 Sandbox 环境中完成以下测试用例：

1. **TC-01 NSIS 全新安装**：验证全新安装不受自定义模板影响，文件和快捷方式写入正常。
2. **TC-02 已安装下再次运行 setup.exe**：检测是否正常弹出选项。
3. **TC-03 维护页选择“仅卸载”**：**核心用例**，验证卸载完后安装器窗口立即 Quit 退出，无后续页面。
4. **TC-04 维护页选择“重新安装 / 修复”**：验证直接重新覆盖安装，App 可打开。
5. **TC-05 升级安装测试**：已安装 0.1.0 时运行 0.1.1 版本，验证能够正常升级并不被 Quit 中断。
6. **TC-06 Windows Apps 卸载**：验证系统控制面板卸载一切正常，不残留无源图标。
7. **TC-07 卸载后重装**：验证卸载后重装依然正常。
8. **TC-08 取消维护流程**：在 Reinstall 页面选择取消，验证不影响系统现有安装。
9. **TC-09 隔离测试**：验证卸载和安装过程对用户照片原件目录无任何触碰。
10. **TC-10 功能组件闭环**：Results 页、Similar Groups、A/B 对决离线工作完全正常。

---

## 8. 后续实现 Checkpoint 建议

不建议在本阶段直接写入或创建自定义模板。

### 推荐下一个 Checkpoint：
`CORE-DESKTOP-NATIVE-NSIS-MAINTENANCE-FLOW-TEMPLATE-DIFF-IMPLEMENT-1` (提取官方 Handlebars 格式原始模板，合入最小 diff，修改 `tauri.conf.json` 配置并于 Sandbox 环境下验证通过)。
