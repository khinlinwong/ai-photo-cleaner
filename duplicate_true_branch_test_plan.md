# AI Photo Cleaner Signal Groups true 分支本地测试规划 - CORE-DUPLICATE-7-PLANNING

## 一、 测试目标

`CORE-DUPLICATE-7` 的目标**不是**默认启用 signal groups，而是规划未来在 development 环境中临时手动打开 `true` 分支，开展小批量本地测试。

具体测试目标包括：
1. **驱动验证**：验证由客观信号派生转换出来的 `similarGroups` 能否正常且顺畅地驱动 Photo Battle 对局与擂台流程。
2. **定量比对**：验证两路（old 与 new）相似照片的分组数量（group count）与成员数量是否一致，或者其中的差异是否能得到合理、科学的技术解释。
3. **分类体系**：验证在 Photo Battle 结束后，决定出的照片结果是否能精准、无偏地归入“保留”与“淘汰候选”两个最终分类中，不产生新的中间状态。
4. **导出一致性**：验证 ZIP 导出打包模块产生的包内容和页面中的物理分区展示一致。
5. **对局闭环**：验证擂台操作中的 `skip`（跳过）、`reset`（重置）、`keep both`（两张都保留）、`cull both`（两张都淘汰）等状态机控制逻辑完全正常。
6. **环境静默阻断**：验证生产构建（production）下，该灰度通道自动闭锁，即使开关临时设为 true，也绝对不启用新版信号流程。

---

## 二、 测试前提

在开始任何 true 分支测试前，必须完全满足以下硬性条件：
1. **基石稳定**：本地 `main` 分支已有稳定 commit 并已成功推送到远程仓库。
2. **工作区干净**：测试前本地工作区必须为 clean 状态（执行 `git status` 无未提交更改），便于比对。
3. **默认极值安全**：`USE_SIGNAL_GROUPS_FOR_BATTLE` 配置常量在源码仓库中默认仍强制为 `false`。
4. **环境局限**：`true` 灰度通道仅允许在本地开发环境（development）下临时被手动更改启用，严禁暴露或污染生产环境。
5. **即测即改回**：一旦测试完成或测试中断，必须在第一时间将开关变量改回 `false`。
6. **禁止提交 true**：在任何情况下，绝不允许将 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 这一默认值提交到 `main` 分支或推送到 GitHub。
7. **无隐私数据测试**：测试过程中不得导入真实的个人隐私和敏感照片，优先使用现有 Demo 项目的照片包或公开无隐私的测试图。

---

## 三、 测试图片集规划

为了逐步且科学地释放测试风险，规划如下四阶段测试数据集：

### 1. Demo 数据集
- **数据源**：使用项目自带的高质量旅行 Mock 照片包（旅游数据集）。
- **预期**：`oldSimilarGroupCount === newSimilarGroupCount`，组数及成员 ID 完全对齐。
- **目标**：确保最基础的相似组对局流程不发生退化与崩溃。

### 2. 小批量本地图片
- **数据源**：本地选取 20-50 张照片。
- **组成**：包含少量具有连拍/极高相似度特性的图片组，以及部分无相似关系的普通照片。
- **目标**：观察感知哈希分析及汉明距离判断是否能正确连通分组，并确认结果整理工作台的 Battle 擂台能自然触发弹出。

### 3. 中批量本地图片
- **数据源**：本地选取 100-300 张照片。
- **组成**：包含多组重叠相似度照片，构成较复杂的图分组。
- **目标**：验证在多相似组环境下浏览器无卡顿及响应延迟，且控制台 QA 开发日志简明，不产生性能刷屏。

### 4. 大批量图片 (可选)
- **数据源**：本地选取 500+ 张照片。
- **目标**：压力测试感知哈希 dHash + BFS 连通分量的 O(n²) 级查找性能上限。
- **红线**：若大批量分析中发生浏览器明显卡顿，禁止继续扩大测试，必须立刻回退并记录性能瓶颈。

---

## 四、 手动测试步骤

未来在进行 CORE-DUPLICATE-7 物理测试时，必须遵循以下步骤执行：

1. **工作区检查**：
   确认当前没有未 commit 的代码修改：
   ```bash
   git status --short
   ```
2. **开关默认值校验**：
   确认 `src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认仍为 `false`。
3. **手动临时开启**：
   将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 修改为 `true`。
4. **启动开发服务器**：
   ```bash
   npm run dev
   ```
   或直接在已有的运行 dev server 中进行局部模块热重载。
5. **打开桌面端工作区**：
   访问 `http://localhost:3000/desktop`。
6. **进行 Demo 流程回归测试**：
   - 载入 Demo 照片。
   - 载入后进入 `/processing` 扫描页，再跳转到 `/results` 结果页。
   - 检查 results 页面是否展示 “需要 PK” 相似标记，擂台对战是否自动激活。
   - 分别测试以下 Photo Battle 操作：
     - 保留左图 / 保留右图。
     - **两张都保留**（`keep both`）。
     - **两张都淘汰**（`cull both`）。
     - **跳过当前对局**（`skip`）。
   - 进行擂台**重置**（`reset`），观察分组状态与推荐 Leader 是否能够正常复原。
   - 测试 **ZIP 安全导出**，检查下载得到的包分区是否与 UI 结果一致。
7. **记录与审计 QA 指标**：
   打开控制台审查 QA 开发日志，记录以下核心指标对比：
   - `oldSimilarGroupCount` 与 `newSimilarGroupCount`
   - `similarGroupCountMismatch`
   - `oldSimilarGroupedPhotoCount` 与 `newSimilarGroupedPhotoCount`
   - `similarGroupedPhotoCountMismatch`
   - `leaderMismatchCount`
8. **恢复默认安全状态**：
   测试结束后，必须立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 改回 `false`。
9. **重新进行发布校验**：
   ```bash
   npm run build
   npm run lint
   ```
10. **代码审查**：
    执行 `git diff`，确认没有提交任何临时将配置改为 `true` 的脏代码。

---

## 五、 验收标准

只有当满足以下全部 19 项指标时，才被判定为 true 分支本地测试通过：
1. **Demo 可完整跑通**：从载入到分析、整理与对局，没有逻辑阻断。
2. **页面路由正常**：`/desktop` → `/processing` → `/results` 跳转衔接无误。
3. **擂台自然弹窗**：识别出相似图后，擂台在工作区自动弹出。
4. **保留左边正常**：操作后，左图状态正确映射为 `keep`，右图转为 `review` / `delete`。
5. **保留右边正常**：操作后，右图状态正确映射为 `keep`，左图转为 `review` / `delete`。
6. **两张都保留正常**：操作后，两图状态在 UI 均呈现为“已保留”。
7. **两张都淘汰正常**：操作后，两图均转为“淘汰候选”。
8. **跳过不新增分类**：选择跳过的照片保持为 `undecided` 待决状态，不进入 `keep` 或 `delete` 分区，未引入第三分类。
9. **重置擂台安全**：点击 reset 能无损复原擂台的待决队列。
10. **分区即时更新**：对局结果改变后，保留区与淘汰候选区分区卡片能够即时刷新重绘。
11. **ZIP 导出准确**：导出 ZIP 中的文件分区和 results 面板的“保留”、“淘汰候选”完美同步。
12. **两路组数基本一致**：`oldSimilarGroupCount === newSimilarGroupCount`（如有轻微差异，必须能通过汉明连通性理论合理解释）。
13. **两路照片总数对齐**：落入相似照片的分组总数完全对齐，或有科学解释。
14. **无负面决策干扰**：`leaderMismatchCount` 为 0，或者确认微小漂移不会改变用户最终的二值分类包内容。
15. **日志环境受控**：QA 开发日志只在 development 下单次简洁输出。
16. **生产环境无污染**：在生产打包（production build）包中，绝对不向控制台输出任何比对日志。
17. **开关归位**：本地测试结束后，配置常量恢复为默认 `false` 稳定状态。
18. **Build 顺利**：`npm run build` 成功。
19. **Lint 顺利**：`npm run lint` 通过，且不含阻塞性 ESLint 或 TS 报错。

---

## 六、 失败处理与回退策略

如果小批量测试中发现了任何崩溃、无限对局、照片丢失、或指标大面积倾斜：
1. **立刻回退开关**：立即在 `featureFlags.ts` 中将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 回滚为 `false`。
2. **杜绝提交脏状态**：严禁提交 `true` 变量，确保 main 分支随时保持可交付与 100% 稳定的 legacy 主流程。
3. **记录详细失败场景**：
   - 记录触发失败的照片数据集规模和类型。
   - 记录 old 与 new 相似组的偏离数量。
   - 记录控制台具体的报错 Call Stack 和错误警告详情。
   - 确认 ZIP 导出数据流是否因为中途跳过而损坏。
4. **禁止盲目修改主逻辑**：不要直接去改动 Context 或 results 页面逻辑。
5. **申请只读分析**：首先提交失败记录，让 Codex 进行只读审查，找出聚类或状态机的边界缺陷。
6. **小步长修复**：基于分析结果，定制专门的微型修复 Checkpoint，修复通过后再重新跑本轮测试流程。

---

## 七、 禁止事项

- **绝对禁止**将 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 这一硬编码提交或 push 到 GitHub。
- **绝对禁止**在开发与测试过程中强行绕过或删除 `process.env.NODE_ENV === 'development'` 生产环境隔离保护。
- **绝对禁止** results 视图、对决组件以及 ZIP 导出逻辑绕过 Context 去直接 import `buildSimilarGroupsFromSignals` 或越权读取 `duplicateGroupQA` 数据。
- **绝对禁止**相似组客观信号在分析及转换层包含 `status` 决策写入，或污染 `displayLabel`/`reasonLabel` 中文文案。
- **绝对禁止**删除目前已被验证十分可靠的 legacy 旧版 `detectDuplicates` 及 `similarGroups` 逻辑（它们是降级兜底的生命线）。
- **绝对禁止**使用真实敏感的照片做本地灰度测试。
- **绝对禁止**在控制台日志中输出 Base64、物理图片绝对路径或完整照片实体对象等敏感元数据。

---

## 八、 后续 Checkpoint 路线

1. **`CORE-DUPLICATE-7` (本地灰度开发调试)**：
   - 按照此规划，在本地临时开启 `USE_SIGNAL_GROUPS_FOR_BATTLE = true`，使用 Demo 与小批量本地图片开展对决、重置、导出等多回合多场景调试。
   - 验证通过后，将开关极值重设为 `false`，确保 main 分支无脏提交。
2. **`CORE-DUPLICATE-7-QA` (灰度测试回归)**：
   - Codex 只读检查回归指标，确认测试结束后本地 git status 的开关已彻底归为 `false`，生产构建安全无偏。
3. **`CORE-DUPLICATE-8-PLANNING` (类型适配与解耦规划)**：
   - 如果 true 本地测试证明两路数据能够完美驱动，规划如何优化接口类型强转（移除 `as unknown as SimilarGroup[]`），让新信号天然具备正式 UI 所需的类型结构，为拔除 legacy 逻辑做好最后的准备。

---

## 九、 CORE-DUPLICATE-7 Demo 实测结果

### 1. 测试范围
- 本轮只完成了 Demo 数据集（Mock 旅行照片包）在 `true` 灰度分支下的流转与比对测试。
- 小批量本地图片测试未执行。
- **限制说明**：因此，当前测试结论仅表明在 Demo 数据集上通过了验证，不能用于说明新信号 true 分支适合全量扩大启用。

### 2. Feature Flag 状态
- 测试前确认：`USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
- 测试中操作：临时手动将其改写为 `true`。
- 测试后恢复：测试结束后，已将其彻底恢复为 `false`。
- 回归校验：执行 `git diff -- src/lib/config/featureFlags.ts` 输出完全为空，无任何 true 脏配置残留。

### 3. Demo 测试结果
- **页面与导航**：`/desktop`、`/processing`、`/results` 等页面跳转与功能均表现正常。
- **擂台自动激活**：扫描完成后，Photo Battle 对决擂台自然弹出。
- **操作动作支持**：
  - “保留左图” / “保留右图”均工作正常。
  - “两张都保留”（`keep both`）工作正常。
  - “两张都标记为淘汰候选”（`cull both`）工作正常。
  - “跳过”操作正常，被跳过照片退回未决对局，未产生第三最终分类。
- **对局重置**：`reset` 操作正常，数据可无损还原。
- **安全导出**：ZIP 导出正常，解压得到的物理分区与 UI 展示的二值分区（“保留”与“淘汰候选”）完全一致。

### 4. QA 指标定量审计
- `oldSimilarGroupCount`: 1
- `newSimilarGroupCount`: 1
- `similarGroupCountMismatch`: false
- `oldSimilarGroupedPhotoCount`: 3
- `newSimilarGroupedPhotoCount`: 3
- `similarGroupedPhotoCountMismatch`: false
- `leaderMismatchCount`: 0

### 5. 结论
- Demo 数据集在 true 分支下的双路校验 100% 对齐一致，逻辑正常。
- **后续步骤**：后续需规划 20-50 张非敏感本地图片进行测试。在此之前，不应扩大启用 true 分支。

---

## 十、 20-50 张非隐私本地图片测试规划

### 1. 测试目的
验证客观信号分组（signal groups）在真实、随机的本地物理图片输入下，是否能稳定、高鲁棒地驱动整个 Photo Battle 擂台流转，而不是仅仅局限于内置的 Demo 种子数据集。

### 2. 测试图片硬性要求
- **数量规模**：选取 20-50 张照片。
- **敏感安全红线**：必须是非隐私、非敏感的公共图片（例如公共风景、旅行街拍等）。**绝对严禁**复制或提交任何包含身份证、车牌、护照、家庭私人肖像等敏感内容的照片进入项目目录或 Git 历史。
- **隔离存放**：测试图仅存放在项目目录外的本地独立文件夹，仅在浏览器中通过文件选择器（File Input）临时载入。
- **样本结构建议**：
  - 建议包含 3-5 组真实的连拍 / 相似照片。
  - 建议包含 10 张以上完全无相似关系的普通干扰照片。
  - 建议包含少量刻意制造的模糊、过曝/欠曝等边缘异常质量样本，以检测指标判定。

### 3. 测试执行步骤
1. **清理工作区**：执行 `git status --short`，确保当前无未提交修改。
2. **开关状态确认**：确认 `src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
3. **临时手动启用**：将开关临时改为 `true`。
4. **启动开发环境**：执行 `npm run dev` 运行本地开发服务器。
5. **载入测试图**：浏览器中打开 `http://localhost:3000/desktop`，选择本地已准备好的 20-50 张非隐私测试照片。
6. **执行扫描分析**：点击开始分析，观察 `/processing` 页面的进度条、日志刷新及分析状态。
7. **对局擂台触发**：分析完成后跳转到 `/results`，确认擂台是否自动被激活弹出。
8. **完成所有 Photo Battle**：
   - 依次测试对决操作：保留左图、保留右图、两张都保留（`keep both`）、两张都淘汰（`cull both`）及跳过对局（`skip`）。
9. **检查整理成果**：确认完成对局后的照片是否即时移入对应的“保留”与“淘汰候选”工作区卡片中。
10. **验证 ZIP 导出**：导出两个物理分区的 ZIP 压缩包，检查其中的照片归类是否与页面结果 100% 同步。
11. **审查开发指标**：记录浏览器 Console 中的两路 QA 对比摘要指标。
12. **恢复开关**：测试结束后，必须立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 改回 `false`。
13. **清除残留验证**：执行 `git diff -- src/lib/config/featureFlags.ts` 确认无任何 `true` 配置残留。

### 4. 必须记录的 QA 审计指标
测试过程中，必须定量与定性记录以下审计项：
- 载入 the 本地图片总数（张）
- 识别出的客观相似组数量（个）
- `oldSimilarGroupCount`（旧算法生成的组数）
- `newSimilarGroupCount`（新信号生成的组数）
- `similarGroupCountMismatch`（组数是否不匹配）
- `oldSimilarGroupedPhotoCount`（旧算法涵盖的照片总数）
- `newSimilarGroupedPhotoCount`（新信号涵盖的照片总数）
- `similarGroupedPhotoCountMismatch`（照片总数是否不匹配）
- `leaderMismatchCount`（组长推荐差异个数）
- Photo Battle 擂台是否可以自动且顺畅地被激活弹出
- 能否正常对所有相似组对局进行表决和清空
- ZIP 导出的照片划分是否和 Results 页面展示的二值归档完全一致
- 分析与渲染阶段是否有感知卡顿或内存泄露崩溃
- 浏览器控制台是否出现 TypeScript 运行时异常

### 5. 验收通过标准
1. `/desktop` → `/processing` → `/results` 全程无卡阻跳转。
2. 对决擂台对新客观信号数据驱动下的连拍相似组能够精准分类并激活。
3. 所有的 PK 动作操作表现正常。
4. 选择 `skip` 跳过的照片能够回到未决状态，不引入额外的第三最终分类。
5. 结果页卡片能响应对局表决做即时局部重绘。
6. ZIP 导出的文件分布与 Results 分区完全匹配。
7. 运行对比日志仅在 development 环境下输出，不污染生产环境。
8. **严禁**在日志中输出图片的 Base64、物理存放路径或完整照片实体对象。
9. 测试结束后开关必须归位为 `false`。
10. `npm run build` 与 `npm run lint` 必须完全成功。
11. 本地代码无脏配置提交。

### 6. 失败处理与安全回退
如果测试过程中产生卡死、照片未分类直接归档、数据偏离或页面空白：
1. **一键回退**：立即在 `featureFlags.ts` 中将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 恢复为 `false`。
2. **禁止带脏提交**：绝不提交 `true` 变量到 Git 历史。
3. **记录场景**：记录使用的测试图片规模、对局卡死时的具体操作类型、old/new group 数量偏差和 Console 中的详细 Call Stack 异常日志。
4. **禁止盲目改码**：保持主流程代码独立，不要尝试直接修改对战或 Context 逻辑。
5. **向 Codex 提报只读分析**：将故障记录提报给 Codex 进行安全只读分析，评估是相似度 BFS 拓扑偏离还是 React 擂台渲染逻辑存在边界漏洞，待修复方案制定并通过审核后再重开测试。

---

## 十一、 类型适配函数后的后续测试推进

随着 `CORE-DUPLICATE-8` 显式类型适配函数 `adaptSignalGroupsToLegacySimilarGroups` 开发的完毕，编译层面的强转债务已经完全移除。
- **下一阶段测试推进**：下一轮可正式重新推进这 20-50 张非敏感本地图片的测试。
- **测试前提强调**：测试开始前，必须再次确认 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。仅在本地开发环境中临时将其手动修改为 `true` 进行测试，测试完毕后必须无条件恢复为 `false`，不留下任何脏配置提交。

## 十二、 CORE-DUPLICATE-9-PLANNING 进展更新

本轮 `CORE-DUPLICATE-9-PLANNING` 已细化 20-50 张非隐私本地图片测试清单，并在项目根目录下新建了 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
下一步在下一轮 `CORE-DUPLICATE-9` 中将严格按照该清单执行 20-50 张非隐私本地图片的 true 分支测试。本轮不执行测试，不修改任何 src 代码，开关默认仍为 `false`。

## 十三、 CORE-DUPLICATE-9 实测状态

- 35 张非隐私本地图片 true 分支测试已通过。
- old/new group count 为 9 / 9。
- old/new grouped photo count 为 22 / 22。
- leaderMismatchCount 为 0。
- Photo Battle、skip、reset、ZIP 导出均正常。
- 当前结论只覆盖小批量测试，尚未覆盖 100-300 张中批量或 500+ 大批量。
- USE_SIGNAL_GROUPS_FOR_BATTLE 已恢复 false。

## 十四、 CORE-DUPLICATE-10-PLANNING 进展更新

本轮 `CORE-DUPLICATE-10-PLANNING` 已在项目根目录新建 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
下一阶段测试重点转为中批量性能、队列稳定性、ZIP 一致性，全面验证在 100-300 张真实照片载入下的主线程负载情况。

---

## 十五、 CORE-DUPLICATE-10 实测状态

- **中批量 200 张仿真/元数据测试已通过**：使用测试仿真脚本在内存中构建 200 张模拟照片（含 15 组 60 张相似照片、140 张非相似普通照片）进行双路比对与状态机流转测试。
- **两路算法比对数据**：
  - `oldSimilarGroupCount` / `newSimilarGroupCount`: 15 / 15
  - `oldSimilarGroupedPhotoCount` / `newSimilarGroupedPhotoCount`: 60 / 60
  - `leaderMismatchCount`: 0
- **测试分析耗时**：31.55 ms ~ 36.07 ms。
- **对决、跳过、重置与导出**：仿真测试中，Photo Battle 各项对局操作、skip、reset 逻辑均正常，无第三分类产生。ZIP 二值归档划分物理一致性 100%。
- **性能与安全边界说明**：
  - 核心提醒：本轮测试为**仿真元数据测试**，并不等于真实 200 张物理大图的读取、解码、Canvas 分析、UI 渲染以及 ZIP 打包压缩等物理压力测试。
  - 开关状态：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已恢复为 `false`，无任何 true 脏配置。
- 下一步规划：明确下一步应规划**真实 100-300 张图片文件**的压力测试。在完成物理图片文件测试前，绝不允许在生产环境或默认主流程中启用 `true` 开关。

---

## 十六、 CORE-DUPLICATE-11-PLANNING 进展更新

- **真实图片文件压力测试规划**：已在项目根目录新建 [duplicate_real_file_stress_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_real_file_stress_test_plan.md) 规划真实 100-300 张物理图片文件的压力测试。
- **三档推进原则**：测试将分为 100 张、200 张和 300 张三档逐步递增测试。如果在 100 张或 200 张阶段已产生明显的浏览器假死或性能卡顿，则立刻中止测试，不继续扩大规模，坚决遵守即测即恢复 `false` 的防线。

---

## 十七、 CORE-DUPLICATE-11 实测状态

- 记录 old 与 new 相似组的偏离数量。
   - 记录控制台具体的报错 Call Stack 和错误警告详情。
   - 确认 ZIP 导出数据流是否因为中途跳过而损坏。
4. **禁止盲目修改主逻辑**：不要直接去改动 Context 或 results 页面逻辑。
5. **申请只读分析**：首先提交失败记录，让 Codex 进行只读审查，找出聚类或状态机的边界缺陷。
6. **小步长修复**：基于分析结果，定制专门的微型修复 Checkpoint，修复通过后再重新跑本轮测试流程。

---

## 七、 禁止事项

- **绝对禁止**将 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 这一硬编码提交或 push 到 GitHub。
- **绝对禁止**在开发与测试过程中强行绕过或删除 `process.env.NODE_ENV === 'development'` 生产环境隔离保护。
- **绝对禁止** results 视图、对决组件以及 ZIP 导出逻辑绕过 Context 去直接 import `buildSimilarGroupsFromSignals` 或越权读取 `duplicateGroupQA` 数据。
- **绝对禁止**相似组客观信号在分析及转换层包含 `status` 决策写入，或污染 `displayLabel`/`reasonLabel` 中文文案。
- **绝对禁止**删除目前已被验证十分可靠的 legacy 旧版 `detectDuplicates` 及 `similarGroups` 逻辑（它们是降级兜底的生命线）。
- **绝对禁止**使用真实敏感的照片做本地灰度测试。
- **绝对禁止**在控制台日志中输出 Base64、物理图片绝对路径或完整照片实体对象等敏感元数据。

---

## 八、 后续 Checkpoint 路线

1. **`CORE-DUPLICATE-7` (本地灰度开发调试)**：
   - 按照此规划，在本地临时开启 `USE_SIGNAL_GROUPS_FOR_BATTLE = true`，使用 Demo 与小批量本地图片开展对决、重置、导出等多回合多场景调试。
   - 验证通过后，将开关极值重设为 `false`，确保 main 分支无脏提交。
2. **`CORE-DUPLICATE-7-QA` (灰度测试回归)**：
   - Codex 只读检查回归指标，确认测试结束后本地 git status 的开关已彻底归为 `false`，生产构建安全无偏。
3. **`CORE-DUPLICATE-8-PLANNING` (类型适配与解耦规划)**：
   - 如果 true 本地测试证明两路数据能够完美驱动，规划如何优化接口类型强转（移除 `as unknown as SimilarGroup[]`），让新信号天然具备正式 UI 所需的类型结构，为拔除 legacy 逻辑做好最后的准备。

---

## 九、 CORE-DUPLICATE-7 Demo 实测结果

### 1. 测试范围
- 本轮只完成了 Demo 数据集（Mock 旅行照片包）在 `true` 灰度分支下的流转与比对测试。
- 小批量本地图片测试未执行。
- **限制说明**：因此，当前测试结论仅表明在 Demo 数据集上通过了验证，不能用于说明新信号 true 分支适合全量扩大启用。

### 2. Feature Flag 状态
- 测试前确认：`USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
- 测试中操作：临时手动将其改写为 `true`。
- 测试后恢复：测试结束后，已将其彻底恢复为 `false`。
- 回归校验：执行 `git diff -- src/lib/config/featureFlags.ts` 输出完全为空，无任何 true 脏配置残留。

### 3. Demo 测试结果
- **页面与导航**：`/desktop`、`/processing`、`/results` 等页面跳转与功能均表现正常。
- **擂台自动激活**：扫描完成后，Photo Battle 对决擂台自然弹出。
- **操作动作支持**：
  - “保留左图” / “保留右图”均工作正常。
  - “两张都保留”（`keep both`）工作正常。
  - “两张都标记为淘汰候选”（`cull both`）工作正常。
  - “跳过”操作正常，被跳过照片退回未决对局，未产生第三最终分类。
- **对局重置**：`reset` 操作正常，数据可无损还原。
- **安全导出**：ZIP 导出正常，解压得到的物理分区与 UI 展示的二值分区（“保留”与“淘汰候选”）完全一致。

### 4. QA 指标定量审计
- `oldSimilarGroupCount`: 1
- `newSimilarGroupCount`: 1
- `similarGroupCountMismatch`: false
- `oldSimilarGroupedPhotoCount`: 3
- `newSimilarGroupedPhotoCount`: 3
- `similarGroupedPhotoCountMismatch`: false
- `leaderMismatchCount`: 0

### 5. 结论
- Demo 数据集在 true 分支下的双路校验 100% 对齐一致，逻辑正常。
- **后续步骤**：后续需规划 20-50 张非敏感本地图片进行测试。在此之前，不应扩大启用 true 分支。

---

## 十、 20-50 张非隐私本地图片测试规划

### 1. 测试目的
验证客观信号分组（signal groups）在真实、随机的本地物理图片输入下，是否能稳定、高鲁棒地驱动整个 Photo Battle 擂台流转，而不是仅仅局限于内置的 Demo 种子数据集。

### 2. 测试图片硬性要求
- **数量规模**：选取 20-50 张照片。
- **敏感安全红线**：必须是非隐私、非敏感的公共图片（例如公共风景、旅行街拍等）。**绝对严禁**复制或提交任何包含身份证、车牌、护照、家庭私人肖像等敏感内容的照片进入项目目录或 Git 历史。
- **隔离存放**：测试图仅存放在项目目录外的本地独立文件夹，仅在浏览器中通过文件选择器（File Input）临时载入。
- **样本结构建议**：
  - 建议包含 3-5 组真实的连拍 / 相似照片。
  - 建议包含 10 张以上完全无相似关系的普通干扰照片。
  - 建议包含 少量刻意制造的模糊、过曝/欠曝等边缘异常质量样本，以检测指标判定。

### 3. 测试执行步骤
1. **清理工作区**：执行 `git status --short`，确保当前无未提交修改。
2. **开关状态确认**：确认 `src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。
3. **临时手动启用**：将开关临时改为 `true`。
4. **启动开发环境**：执行 `npm run dev` 运行本地开发服务器。
5. **载入测试图**：浏览器中打开 `http://localhost:3000/desktop`，选择本地已准备好的 20-50 张非隐私测试照片。
6. **执行扫描分析**：点击开始分析，观察 `/processing` 页面的进度条、日志刷新及分析状态。
7. **对局擂台触发**：分析完成后跳转到 `/results`，确认擂台是否自动被激活弹出。
8. **完成所有 Photo Battle**：
   - 依次测试对决操作：保留左图、保留右图、两张都保留（`keep both`）、两张都淘汰（`cull both`）及跳过对局（`skip`）。
9. **检查整理成果**：确认完成对局后的照片是否即时移入对应的“保留”与“淘汰候选”工作区卡片中。
10. **验证 ZIP 导出**：导出两个物理分区的 ZIP 压缩包，检查其中的照片归类是否与页面结果 100% 同步。
11. **审查开发指标**：记录浏览器 Console 中的两路 QA 对比摘要指标。
12. **恢复开关**：测试结束后，必须立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 改回 `false`。
13. **清除残留验证**：执行 `git diff -- src/lib/config/featureFlags.ts` 确认无任何 `true` 配置残留。

### 4. 必须记录的 QA 审计指标
测试过程中，必须定量与定性记录以下审计项：
- 载入 the 本地图片总数（张）
- 识别出的客观相似组数量（个）
- `oldSimilarGroupCount`（旧算法生成的组数）
- `newSimilarGroupCount`（新信号生成的组数）
- `similarGroupCountMismatch`（组数是否不匹配）
- `oldSimilarGroupedPhotoCount`（旧算法涵盖的照片总数）
- `newSimilarGroupedPhotoCount`（新信号涵盖的照片总数）
- `similarGroupedPhotoCountMismatch`（照片总数是否不匹配）
- `leaderMismatchCount`（组长推荐差异个数）
- Photo Battle 擂台是否可以自动且顺畅地被激活弹出
- 能否正常对所有相似组对局进行表决和清空
- ZIP 导出的照片划分是否和 Results 页面展示的二值归档完全一致
- 分析与渲染阶段是否有感知卡顿或内存泄露崩溃
- 浏览器控制台是否出现 TypeScript 运行时异常

### 5. 验收通过标准
1. `/desktop` → `/processing` → `/results` 全程无卡阻跳转。
2. 对决擂台对新客观信号数据驱动下的连拍相似组能够精准分类并激活。
3. 所有的 PK 动作操作表现正常。
4. 选择 `skip` 跳过的照片能够回到未决状态，不引入额外的第三最终分类。
5. 结果页卡片能响应对局表决做即时局部重绘。
6. ZIP 导出的文件分布与 Results 分区完全匹配。
7. 运行对比日志仅在 development 环境下输出，不污染生产环境。
8. **严禁**在日志中输出图片的 Base64、物理存放路径或完整照片实体对象。
9. 测试结束后开关必须归位为 `false`。
10. `npm run build` 与 `npm run lint` 必须完全成功。
11. 本地代码无脏配置提交。

### 6. 失败处理与安全回退
如果测试过程中产生卡死、照片未分类直接归档、数据偏离或页面空白：
1. **一键回退**：立即在 `featureFlags.ts` 中将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 恢复为 `false`。
2. **禁止带脏提交**：绝不提交 `true` 变量到 Git 历史。
3. **记录场景**：记录使用的测试图片规模、对局卡死时的具体操作类型、old/new group 数量偏差和 Console 中的详细 Call Stack 异常日志。
4. **禁止盲目改码**：保持主流程代码独立，不要尝试直接修改对战或 Context 逻辑。
5. **向 Codex 提报只读分析**：将故障记录提报给 Codex 进行安全只读分析，评估是相似度 BFS 拓扑偏离还是 React 擂台渲染逻辑存在边界漏洞，待修复方案制定并通过审核后再重开测试。

---

## 十一、 类型适配函数后的后续测试推进

随着 `CORE-DUPLICATE-8` 显式类型适配函数 `adaptSignalGroupsToLegacySimilarGroups` 开发的完毕，编译层面的强转债务已经完全移除。
- **下一阶段测试推进**：下一轮可正式重新推进这 20-50 张非敏感本地图片的测试。
- **测试前提强调**：测试开始前，必须再次确认 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认值为 `false`。仅在本地开发环境中临时将其手动修改为 `true` 进行测试，测试完毕后必须无条件恢复为 `false`，不留下任何脏配置提交。

## 十二、 CORE-DUPLICATE-9-PLANNING 进展更新

本轮 `CORE-DUPLICATE-9-PLANNING` 已细化 20-50 张非隐私本地图片测试清单，并在项目根目录下新建了 [duplicate_local_photo_test_checklist.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_local_photo_test_checklist.md)。
下一步在下一轮 `CORE-DUPLICATE-9` 中将严格按照该清单执行 20-50 张非隐私本地图片的 true 分支测试。本轮不执行测试，不修改任何 src 代码，开关默认仍为 `false`。

## 十三、 CORE-DUPLICATE-9 实测状态

- 35 张非隐私本地图片 true 分支测试已通过。
- old/new group count 为 9 / 9。
- old/new grouped photo count 为 22 / 22。
- leaderMismatchCount 为 0。
- Photo Battle、skip、reset、ZIP 导出均正常。
- 当前结论只覆盖小批量测试，尚未覆盖 100-300 张中批量或 500+ 大批量。
- USE_SIGNAL_GROUPS_FOR_BATTLE 已恢复 false。

## 十四、 CORE-DUPLICATE-10-PLANNING 进展更新

本轮 `CORE-DUPLICATE-10-PLANNING` 已在项目根目录新建 [duplicate_medium_batch_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_medium_batch_test_plan.md)。
下一阶段测试重点转为中批量性能、队列稳定性、ZIP 一致性，全面验证在 100-300 张真实照片载入下的主线程负载情况。

---

## 十五、 CORE-DUPLICATE-10 实测状态

- **中批量 200 张仿真/元数据测试已通过**：使用测试仿真脚本在内存中构建 200 张模拟照片（含 15 组 60 张相似照片、140 张非相似普通照片）进行双路比对与状态机流转测试。
- **两路算法比对数据**：
  - `oldSimilarGroupCount` / `newSimilarGroupCount`: 15 / 15
  - `oldSimilarGroupedPhotoCount` / `newSimilarGroupedPhotoCount`: 60 / 60
  - `leaderMismatchCount`: 0
- **测试分析耗时**：31.55 ms ~ 36.07 ms。
- **对决、跳过、重置与导出**：仿真测试中，Photo Battle 各项对局操作、skip、reset 逻辑均正常，无第三分类产生。ZIP 二值归档划分物理一致性 100%。
- **性能与安全边界说明**：
  - 核心提醒：本轮测试为**仿真元数据测试**，并不等于真实 200 张物理大图的读取、解码、Canvas 分析、UI 渲染以及 ZIP 打包压缩等物理压力测试。
  - 开关状态：`USE_SIGNAL_GROUPS_FOR_BATTLE` 已恢复为 `false`，无任何 true 脏配置。
- 下一步规划：明确下一步应规划**真实 100-300 张图片文件**的压力测试。在完成物理图片文件测试前，绝不允许在生产环境或默认主流程中启用 `true` 开关。

---

## 十六、 CORE-DUPLICATE-11-PLANNING 进展更新

- **真实图片文件压力测试规划**：已在项目根目录新建 [duplicate_real_file_stress_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_real_file_stress_test_plan.md) 规划真实 100-300 张物理图片文件的压力测试。
- **三档推进原则**：测试将分为 100 张、200 张和 300 张三档逐步递增测试。如果在 100 张或 200 张阶段已产生明显的浏览器假死或性能卡顿，则立刻中止测试，不继续扩大规模，坚决遵守即测即恢复 `false` 的防线。

---

## 十七、 CORE-DUPLICATE-11 实测状态

- **真实 BMP 图片文件 true 分支测试已通过**：分三档完成了真实物理 BMP 格式图片的压力回归测试。
- **双路 parity 校验审计数据**：
  - **100 张**：4 / 4 groups，16 / 16 grouped photos，leaderMismatchCount 0。分析耗时 947.95 ms。
  - **200 张**：7 / 7 groups，28 / 28 grouped photos，leaderMismatchCount 0。分析耗时 1653.18 ms。
  - **300 张**：7 / 7 groups，28 / 28 grouped photos，leaderMismatchCount 0。分析耗时 2469.56 ms。
- **对决、跳过、重置与 ZIP 导出**：各档位核心功能通畅无误，ZIP 物理分区一致性校验 100% 成功，开关已归位恢复为 `false`。
- **测试局限与下一步规划**：本测试仅覆盖小尺寸 24-bit 无压缩 BMP 格式（300 张总计约 108 MB 物理数据）。不能代表 JPG / PNG / WebP 压缩图片格式的解码压力，也不代表 RAW / HEIC 或 10MB 级手机大图的承载瓶颈。下一步不能直接默认或生产启用 true，仍需要规划 500+ BMP 大批量分档压测，或进行混合压缩格式真实图片测试规划。

---

## 十八、 CORE-DUPLICATE-12-PLANNING 进展更新

- **混合格式压力测试规划**：已在项目根目录新建 [duplicate_mixed_format_test_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/duplicate_mixed_format_test_plan.md) 规划 JPG / PNG / WebP 混合格式真实图片的 true 分支测试方案。
- **逐步递增与中止规范**：混合格式测试同样按 100 张、200 张和 300 张三档进行压测。若 100 张或 200 张出现严重卡顿，必须遵循硬截断原则停止测试，并彻底物理恢复 `false` 极值，确保主线程交互体验不受压缩解压瓶颈的影响。

---

## 十九、 CORE-DUPLICATE-12-ABORT-DOCS 进展更新

- **CORE-DUPLICATE-12 混合格式测试中止**：100 张 JPG / PNG / WebP 混合格式真实图片测试已启动并成功跳转至 `/results`，但由于测试脚本在提取 React Fiber 内 `duplicateGroupQA` 时遇到障碍并超时，导致 100 张测试未能完整获取 QA 数据，200 张与 300 张测试也因此未执行。
- **结论限制**：本阶段不能声明混合格式真实图片测试通过。
- **安全恢复**：测试已立刻安全中止，`USE_SIGNAL_GROUPS_FOR_BATTLE` 已物理恢复为默认极值 `false`，确保生产环境和默认主流程完全不受影响。

---

## 二十、 CORE-DUPLICATE-12-RETRY-PLANNING 进展更新

- **混合格式重试读取方案规划**：针对第一次测试在 headless 环境下读取 React Fiber 状态返回 `None` 导致的轮询超时，本轮重试将彻底放弃 React Fiber 依赖。
- **新 QA 指标读取方式**：规划引入控制台开发日志摘要（Console Summary，方案 A）、可见 UI 结果（方案 B）以及 dev-only QA 挂载输出（方案 C）作为更稳定的校验数据源，消除测试脚本对 React 内部私有结构的依赖。
- **重试与隔离原则**：继续严格坚守“即测即恢复 false”的安全红线。在重试通过前，正式主流程依然保持为 legacy 方案不变。
- **CORE-DUPLICATE-12-RETRY 实测状态**：使用外部 100 张混合格式图片成功进行 retry 测试。100 张实测数据对齐：15 / 15 groups，60 / 60 grouped photos，leaderMismatchCount 0。页面上 JPG/PNG/WebP 均正常预览，Photo Battle、skip、reset 以及双路 ZIP 二值归档导出和分区 100% 一致。本档测试已完成且已物理恢复 `false` 开关。由于分步重试策略，200 张与 300 张测试按计划未执行，同时 HEIC / RAW 本阶段依然尚未测试。
