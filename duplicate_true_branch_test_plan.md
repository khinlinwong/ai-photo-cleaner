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
- **当前状态约束**：主流程目前必须保持默认 `USE_SIGNAL_GROUPS_FOR_BATTLE = false`，不允许直接提交 `true`，生产环境依旧强制使用 legacy。
- **后续步骤**：后续需规划 20-50 张非敏感本地图片进行测试。在此之前，不应扩大启用 true 分支。
