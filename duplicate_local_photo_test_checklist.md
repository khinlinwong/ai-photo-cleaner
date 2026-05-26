# AI Photo Cleaner 本地非隐私图片 true 分支测试清单 - CORE-DUPLICATE-9-PLANNING

## 一、 测试目标

`CORE-DUPLICATE-9` 的核心目标是使用 20-50 张非隐私本地图片，在开发环境（development）中临时手动启用 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 灰度通道，验证由客观算法信号转换适配出来的 `similarGroups` 是否能稳定、顺畅地驱动 Photo Battle 对决工作流。

**核心定位声明**：
- 本测试**不是**生产环境（production）全量启用。
- 本测试**不是**默认主流程切换。
- 测试完成后，必须在 turn 结束前将配置立即恢复为 `USE_SIGNAL_GROUPS_FOR_BATTLE = false` 极值，不提交任何脏配置。

---

## 二、 测试图片选择标准

为了保护用户的隐私安全并保证测试过程合规、无负面，所使用的测试图片必须严格对齐以下边界：

1. **数量规模**：选取 20-50 张本地照片。
2. **非敏感声明**：必须使用完全无隐私、非敏感的照片（例如公开的室外风景、风景街拍、公共建筑等）。
3. **禁止私人肖像**：**绝对禁止**使用任何家庭私人照片、私人肖像或涉及个人隐私的图像。
4. **禁止证件敏感图**：**绝对禁止**使用包含身份证、车牌号、护照、银行卡、各种账单或含敏感公司信息的照片。
5. **禁止客户照片**：**绝对禁止**使用真实用户的隐私客户图片做测试。
6. **不进入物理目录**：**绝对禁止**将测试图片复制到项目的任何物理目录内。
7. **禁止提交 Git**：**绝对禁止**将任何测试图片提交到 Git 仓库历史中。
8. **沙箱式载入**：只在运行 dev server 后，在浏览器中通过 File Input 手动临时选择以加载进内存，测试完关闭浏览器即销毁。
9. **建议样本结构**：
   - 包含 3-5 组真实的连拍 / 相似照片（保证汉明距离图拓扑聚类）。
   - 包含 10 张以上完全独立的普通非相似照片。
   - 包含少量对焦虚焦/模糊图片样本（如果有）。
   - 包含少量曝光异常的亮光/暗光照片样本（如果有）。

---

## 三、 测试前检查

在临时手动更改开关前，必须严格确认以下条件已完美达成：
1. **工作区状态**：执行 `git status --short` 确认当前工作区完全干净（clean）。
2. **GitHub 推送**：本地最新的稳定 commit（e18c84e 适配器提交）已成功 push 到远程 GitHub。
3. **初始开关确认**：`src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为默认 `false`。
4. **生产隔离完备**：production 运行时环境防护逻辑完备且没有被改动。
5. **发布无报错**：执行 `npm run build` 编译成功。
6. **Lint 校验无报错**：执行 `npm run lint` 通过。
7. **数据隔离合规**：确认本地准备的测试图片存放在外部沙箱目录，不在项目源码路径内，且不包含任何敏感和隐私内容。

---

## 四、 临时 true 测试步骤

未来在进行 CORE-DUPLICATE-9 手动测试时，执行人必须遵循以下动作清单顺序操作：

1. **检查 Git 干净度**：
   ```bash
   git status --short
   ```
2. **临时启用 true 开关**：
   打开 `src/lib/config/featureFlags.ts`，将开关临时修改为：
   ```typescript
   export const USE_SIGNAL_GROUPS_FOR_BATTLE = true;
   ```
3. **启动开发服务器**：
   ```bash
   npm run dev
   ```
4. **打开工作区**：
   访问 `http://localhost:3000/desktop`。
5. **选择本地非隐私测试图片**：
   点击文件载入，选择已准备好的 20-50 张沙箱非敏感本地图片。
6. **开始 AI 扫描分析**：
   点击开始整理，并等待 `/processing` 页面 Canvas 像素诊断仪分析完毕。
7. **检查 Results 擂台触发**：
   扫描完毕自动跳转至 `/results`，确认 Photo Battle 擂台弹窗是否自动弹出。
8. **审查 Console 安全与日志**：
   审查控制台，确认开发回归日志输出正常，且**没有**泄露打印任何图片的本地绝对路径、Base64 或完整照片对象等元数据。
9. **完成所有擂台对局**：
   依次点击并验证以下操作：
   - 保留左图（`keep_left`）/ 保留右图（`keep_right`）。
   - 两张都保留（`keep_both`）。
   - 两张都标记为淘汰候选（`cull_both`）。
   - 跳过对局（`skip`）。
   - 重置擂台（`reset`）。
10. **验证 Results 分区重绘**：
    确认经过擂台决断后的卡片，能即时在 results 工作区的“保留”与“淘汰候选”分区中完成映射移动。未决对局在未 PK 完成前，右上角导出按键是否有强警示强弹窗阻断。
11. **测试 ZIP 安全导出**：
    - 导出保留区 ZIP 并解压。
    - 导出淘汰候选区 ZIP 并解压。
    - 验证物理压缩包中的图片划分，是否与 results 工作台上的 UI 二值区分 100% 相同。
12. **定量记录指标**：
    按如下 QA 指标审计标准记录开发 console 中的测试数字。
13. **立即恢复 false 开关**：
    测试完毕后，立刻在 `featureFlags.ts` 中恢复为：
    ```typescript
    export const USE_SIGNAL_GROUPS_FOR_BATTLE = false;
    ```
14. **校验 Git Diff 残留**：
    ```bash
    git diff -- src/lib/config/featureFlags.ts
    ```
    确认开关配置没有任何 true 差异残留，工作区恢复为测试前的 clean 状态。
15. **回归发布包校验**：
    ```bash
    npm run build
    npm run lint
    ```

---

## 五、 必须记录的 QA 审计指标

测试期间，必须如实记录以下全部指标以对齐回归分析：
- **图片数量**：
- **测试图片类型说明**：
- **oldSimilarGroupCount**（旧算法组数）：
- **newSimilarGroupCount**（新客观信号转换适配组数）：
- **similarGroupCountMismatch**（组数是否不匹配）：
- **oldSimilarGroupedPhotoCount**（旧算法相似照片张数）：
- **newSimilarGroupedPhotoCount**（新客观信号转换适配张数）：
- **similarGroupedPhotoCountMismatch**（照片总张数是否不匹配）：
- **leaderMismatchCount**（组长 ID 不一致数）：
- **Photo Battle 是否自动触发**：
- **PK 组数是否合理对齐**：
- **分析与操作是否出现感知卡顿**：
- **是否出现任何控制台或页面报错**：
- **ZIP 导出归档与 Results 分区是否 100% 一致**：
- **是否出现除“保留”/“淘汰候选”外的第三最终分类**：
- **测试后开关是否恢复为 false**：
- **npm run build 是否通过**：
- **npm run lint 是否通过**：

---

## 六、 验收通过标准

只有以下 16 项标准全数达标，才判定测试通过：
1. `/desktop` → `/processing` → `/results` 全程跳转渲染流畅。
2. 对决擂台对 20-50 张本地真实图片产生的分组能精准识别并弹出。
3. 所有擂台 PK 物理操作和 UI 按键表现正常。
4. 跳过的待决照片不进入“保留”与“淘汰候选”，且未引入第三分类。
5. reset 擂台重置不会破坏内存状态及 photos 结构。
6. “保留”与“淘汰候选”工作区更新正常。
7. ZIP 导出文件划分与 results 面板展示的二值区分完美一致。
8. 运行比对日志仅在 development 环境下输出。
9. 控制台日志不含本地绝对路径、Base64 以及完整照片实体。
10. 大批量多分组对决时页面不产生内存溢出与卡死。
11. 测试结束后，配置开关 100% 恢复为默认 `false`。
12. 执行 `git diff` 确认开关无 `true` 差异残留。
13. `npm run build` 通过。
14. `npm run lint` 通过。

---

## 七、 失败处理与安全回退

如果在测试过程中，页面死锁、ZIP 导出不匹配、或者双路组数出现偏离：
1. **立即归位**：立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 改回 `false`。
2. **禁止带脏提交**：绝不提交和 push `true` 配置。
3. **详细故障记录**：
   - 记录触发卡死或偏离的照片数量与大致聚类情况。
   - 记录控制台报错的完整 Call Stack。
   - 记录 `old/new` 相似组的偏离比对差额。
4. **禁止盲目改动代码**：不要在没有搞清原因的情况下盲目改动 Context 和对局逻辑。
5. **提报只读分析**：将数据提报给 Codex 进行安全只读分析。
6. **微量修复**：根据 Codex 诊断，制定专门的最小修复 checkpoint，通过后再重跑测试。

---

## 八、 安全注意事项与红线

- **绝对禁止**将测试图片物理复制到项目目录下。
- **绝对禁止**将任何测试图片 commit 或 push 到 Git 历史中。
- **绝对禁止**使用含有个人敏感肖像、证件、账单、车牌等的隐私照片测试。
- **绝对禁止**在控制台或任何地方打印 Base64 及绝对文件物理路径。
- **绝对禁止**将 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 极值提交或推送。
- **绝对禁止**改动或绕过 Context 内部的 `process.env.NODE_ENV === 'development'` 生产环境物理隔离阻断守卫。

---

## CORE-DUPLICATE-9 本地 35 张非隐私图片实测结果

测试范围：
- 本轮执行 35 张非隐私、非敏感本地图片测试。
- 测试图片通过外部数学图形函数脚本在项目目录外生成。
- 未使用私人照片、客户照片、证件、车牌、账单等敏感图片。
- 测试图片没有复制进项目目录。
- 测试图片没有提交到 Git。

Feature Flag 状态：
- 测试前 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 测试中临时改为 true。
- 测试结束后已恢复 false。
- git diff -- src/lib/config/featureFlags.ts 无 true 残留。
- production guard 未修改。

测试结果：
- /desktop 正常。
- /processing 正常。
- /results 正常。
- Photo Battle 自动触发正常。
- PK 组数合理。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常，未产生第三最终分类。
- reset 正常。
- ZIP 导出正常，内容和页面分区一致。
- 无卡顿。
- 无报错。
- 无第三最终分类。

QA 指标：
- 图片数量：35
- oldSimilarGroupCount: 9
- newSimilarGroupCount: 9
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 22
- newSimilarGroupedPhotoCount: 22
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0

结论：
- 小批量 35 张非隐私本地图片 true 分支测试通过。
- 当前仍必须保持 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 不允许默认启用 true。
- 不允许 production 启用 true。
- 下一步建议规划 100-300 张中批量非隐私图片测试。
- 中批量测试前，正式主流程仍保持 legacy。
