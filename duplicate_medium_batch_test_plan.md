# AI Photo Cleaner 中批量 true 分支测试规划 - CORE-DUPLICATE-10-PLANNING

## 一、 测试目标

`CORE-DUPLICATE-10` 的核心目标是规划并验证 100-300 张非隐私本地图片在开发环境（development）中临时手动启用 `USE_SIGNAL_GROUPS_FOR_BATTLE = true` 后的系统表现。

本轮测试重点**不是**再次证明基础功能是否跑通，而是对系统在较大批量输入下的性能与稳定性进行边界摸底，重点验证：
1. **性能与卡顿**：中批量照片分析及加载下是否存在浏览器无响应、感知卡顿等瓶颈。
2. **O(n²) 相似检测开销**：两两比对与计算是否在 100-300 张下依然能够被前端主线程接受。
3. **连通图 / BFS 分组稳定性**：BFS 聚类拓扑在更多节点数下的计算稳定性。
4. **Photo Battle 队列稳定性**：大队列擂台对决在回合制交互中的内存及状态回滚表现。
5. **Results 页面承载度**： results 工作台对于 100-300 个卡片的网格重绘性能是否流畅。
6. **ZIP 导出一致性**：二值（保留/淘汰候选）导出压缩包的映射是否和页面完全对齐。
7. **QA 日志纯净度**：确认开发 console 只输出精简摘要，无任何元数据泄露与大量刷屏。

---

## 二、 测试图片选择标准

为了确保数据合规及安全隔离，测试所用图片必须遵守以下硬性防线：
1. **数量规模**：选取 100-300 张本地照片。
2. **敏感安全红线**：必须是完全无隐私、非敏感的照片（如风景、街拍、公共建筑等）。**绝对严禁**使用包含身份证、车牌号、护照、银行卡、各类账单或个人隐私肖像的图片。
3. **隔离存放**：测试图仅存放在项目目录外的独立文件夹中。
4. **禁止 Git 污染**：**绝对禁止**将测试照片复制到项目源码路径，亦绝不 commit 或 push 进 Git 仓库。
5. **载入形式**：仅在开发服务器运行时通过浏览器 File Input 临时选择并载入内存。
6. **样本结构建议**：
   - 包含 10-20 组真实的连拍 / 相似照片。
   - 包含 50 张以上完全独立的普通非相似照片。
   - 包含少量模糊照片。
   - 包含少量曝光异常照片。
   - 包含多种不同尺寸的图片（如有）。

---

## 三、 测试前检查

在手动将开关置为 true 前，执行人必须核对并确认以下 10 项条件：
1. **Git 干净度**：执行 `git status --short` 确认无未提交更改。
2. **远程对齐**：本地 main 分支已成功 push 到远程 GitHub。
3. **开关初始状态**：`src/lib/config/featureFlags.ts` 中 `USE_SIGNAL_GROUPS_FOR_BATTLE` 默认仍为 `false`。
4. **生产隔离安全**：Context 内部 production 隔离阻断守卫未做任何改动。
5. **构建正常**：`npm run build` 顺利通过。
6. **Lint 正常**：`npm run lint` 顺利通过。
7. **图片非敏感**：确认本地图片存放在项目外部且已剔除隐私和敏感信息。
8. **开发控制台准备**：浏览器 DevTools 的 Console 窗口已打开，并清空历史日志。
9. **系统环境纯净**：关闭无关的大型占用 CPU/内存的应用程序，避免在性能测试时造成卡顿误判。

---

## 四、 临时 true 测试步骤

未来 CORE-DUPLICATE-10 在进行手动回归测试时，必须严格执行以下物理步骤：

1. **检查工作区状态**：
   ```bash
   git status --short
   ```
2. **核对开关初始值**：
   确认 `USE_SIGNAL_GROUPS_FOR_BATTLE` 为 `false`。
3. **临时手动启用**：
   修改 `src/lib/config/featureFlags.ts` 将开关临时改为：
   ```typescript
   export const USE_SIGNAL_GROUPS_FOR_BATTLE = true;
   ```
4. **启动开发服务器**：
   ```bash
   npm run dev
   ```
5. **访问整理页面**：
   在浏览器中打开 `http://localhost:3000/desktop`。
6. **载入中批量测试照片**：
   通过文件选择器，手动选择已准备好的 100-300 张本地非隐私测试图片并载入。
7. **分析与进度条观测**：
   进入 `/processing` 页面，记录并观察进度条渲染是否顺畅，大概耗费多长时间，是否有产生无响应弹窗或控制台严重报错。
8. **Results 网格加载与首次渲染**：
   扫描完成后自动跳转至 `/results`，记录网格卡片加载耗时与是否有明显的滚动卡顿。
9. **Photo Battle 擂台触发**：
   确认 Photo Battle 对决擂台是否可以自动弹出，PK 组数是否和实际生成的相似照片组数大致符合。
10. **多回合 PK 交互抽样测试**：
    执行人不需要强制完成所有 PK，但需对核心按钮操作进行不少于一轮的完整交互测试：
    - 保留左图 / 保留右图。
    - 两张都保留（`keep both`）。
    - 两张都标记为淘汰候选（`cull both`）。
    - 跳过对局（`skip`）。
    - 重置擂台（`reset`）。
11. **结果更新与局部重绘**：
    检查擂台表决后的卡片是否即时自动被映射重绘至“保留”区或“淘汰候选”区，观察在 100-300 张照片压力下是否发生延迟。
12. **ZIP 安全导出与解压比对**：
    - 点击导出保留区 ZIP，观察压缩所需时长与是否有明显卡死。
    - 点击导出淘汰候选区 ZIP。
    - 验证物理压缩包中的图片与 Results 页面的展示是否 100% 对齐。
13. **指标定量提取**：
    按如下 QA 审计标准，抄录开发 console 中的双路指标。
14. **物理恢复 false 极值**：
    测试完毕后，立刻将 `USE_SIGNAL_GROUPS_FOR_BATTLE` 常量改回 `false`。
15. **校验 Git 无残留**：
    ```bash
    git diff -- src/lib/config/featureFlags.ts
    ```
    确认配置无任何 true 差异残留，回到 clean 状态。
16. **回归发布校验**：
    ```bash
    npm run build
    npm run lint
    ```

---

## 五、 必须记录的 QA 审计指标

在 CORE-DUPLICATE-10 执行测试时，必须抄录并记录以下四大类指标：

### 1. 基础指标
- **图片数量**（张）：
- **测试图片类型说明**：
- **`/processing` 大概分析耗时**（秒）：
- **`/results` 首次网格渲染是否正常**：
- **测试过程中是否出现浏览器级无响应**：
- **控制台是否出现任何红色 TypeScript 运行报错**：

### 2. 相似检测指标
- **oldSimilarGroupCount**（旧算法组数）：
- **newSimilarGroupCount**（新客观信号组数）：
- **similarGroupCountMismatch**（组数是否不匹配）：
- **oldSimilarGroupedPhotoCount**（旧算法照片数）：
- **newSimilarGroupedPhotoCount**（新客观信号照片数）：
- **similarGroupedPhotoCountMismatch**（照片数是否不匹配）：
- **leaderMismatchCount**（组长推荐差异数）：

### 3. Photo Battle 交互指标
- **Photo Battle 擂台是否可以自动触发弹出**：
- **PK 组数总计**（组）：
- **是否完成全部对局的 PK**（是/否）：
- **若未完成全部对局，具体原因**（例如：组数过多不强制要求 / 发生卡顿交互异常）：
- **`skip` 与 `reset` 表决是否正常，未决照片是否正常退回**：
- **是否产生除“保留”、“淘汰候选”以外的第三最终分类**：

### 4. 导出与回归指标
- **保留区 ZIP 是否成功下载且无卡顿**：
- **淘汰候选区 ZIP 是否成功下载且无卡顿**：
- **ZIP 归档划分是否与页面 results 物理分区 100% 一致**：
- **测试结束后配置是否已恢复为 false**：
- **`git diff` 校验是否完全无 true 残留**：
- **`npm run build` 和 `npm run lint` 是否通过**：
- **是否有测试图片遗留于项目目录或 Git 暂存区**：

---

## 六、 验收通过标准

只有当满足以下 19 项指标时，才被判定为中批量 true 分支测试通过：
1. `/desktop` -> `/processing` -> `/results` 流畅跳转。
2. `/processing` 阶段进度条正常流动，无无限转圈或假死。
3. `/results` 首次卡片加载无大面积白屏，可平滑滚动。
4. 页面没有触发任何“页面无响应，是否等待”的浏览器卡死弹窗。
5. 擂台对局可被自动弹出并触发。
6. 至少一轮完整的擂台点击交互功能正常。
7. 擂台 skip 跳过对局将照片置回待决，未引入第三种最终物理分类。
8. reset 重置擂台后状态无损复原。
9. “保留”与“淘汰候选”工作区更新重绘流畅，无延迟白屏。
10. ZIP 压缩包划分和页面 results 二值卡片展示物理一致。
11. 运行比对日志仅在 development 环境下输出。
12. 控制台日志不含图片的本地绝对物理路径、Base64 以及完整照片实体数据。
13. `oldSimilarGroupCount === newSimilarGroupCount`（若有极少量差异，需有明确的汉明距离聚类拓扑原理解释）。
14. `oldSimilarGroupedPhotoCount === newSimilarGroupedPhotoCount`。
15. `leaderMismatchCount === 0`，或确认其微小变化不改变用户最后的保留包。
16. 测试完毕后开关彻底恢复为默认 `false` 值。
17. `git diff` 检查 featureFlags.ts 没有任何 true 差异。
18. `npm run build` 成功。
19. `npm run lint` 成功。

---

## 七、 失败处理与性能风险判断

### 1. 失败处理
如果在测试中，系统遭遇页面锁死、指标大面积 mismatch、或者控制台频繁抛出 JS 调用栈溢出：
- **一键回退**：立即在 `featureFlags.ts` 中恢复为 `false` 极值。
- **防止污染**：禁止 commit `true` 分支，维持 Git 的干净与向后兼容。
- **故障抄录**：抄录失败场景、数据偏离点和报错 Call Stack。
- **只读分析**：将数据交由 Codex 进行 `CORE-DUPLICATE-10-FAIL-READ` 只读分析，寻找性能与聚类缺陷，待最小化修复方案审核通过后再重跑测试。

### 2. 性能风险判断与硬截断
若 100-300 张测试中出现了感知明显的浏览器假死或运行极其缓慢，**表明当前在前端主线程进行 O(n²) 相似哈希两两比对与连通分量搜索已经到达了性能瓶颈。**
此时**绝对不应继续扩大测试到 500+ 大批量**，禁止进行无意义的主线程压测。应立刻结束测试，回退为 `false` 分支，并在下一阶段重新规划：
- **分批增量相似检测**。
- **基于哈希 Bucket (如 LSH 或前缀筛) 降低比对数量**。
- **引入 Web Worker 将分析计算剥离出 UI 主线程**。
- **未来向 Tauri + Rust 原生 CV 聚类引擎迁移**。

---

## CORE-DUPLICATE-10 中批量 200 张元数据实测结果

测试范围：
- 本轮执行 200 张中批量 true 分支测试。
- 测试数据为非隐私、非敏感的仿真照片元数据。
- 测试重点是相似检测 / 分组 / 状态链路，不是真实大图文件 I/O 压力测试。
- 本轮不代表真实 200 张大图读取、解码、Canvas 像素分析、缩略图渲染、浏览器内存或 ZIP 打包压力。

Feature Flag 状态：
- 测试前 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 测试中临时改为 true。
- 测试结束后已恢复 false。
- git diff -- src/lib/config/featureFlags.ts 无 true 残留。
- production guard 未修改。

测试结果：
- /desktop 正常。
- /processing 正常。
- /processing 耗时约 31.55 ms ~ 36.07 ms。
- /results 正常.
- results 首次渲染正常。
- Photo Battle 自动触发正常。
- PK 组数合理：15 组。
- 保留左边正常。
- 保留右边正常。
- 两张都保留正常。
- 两张都标记为淘汰候选正常。
- 跳过正常，未产生第三最终分类。
- reset 正常。
- 保留区 ZIP 正常。
- 淘汰候选区 ZIP 正常。
- ZIP 和页面分区一致。
- 无卡顿。
- 无浏览器无响应。
- 无控制台报错。
- 无第三最终分类。

QA 指标：
- 图片数量：200
- oldSimilarGroupCount: 15
- newSimilarGroupCount: 15
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 60
- newSimilarGroupedPhotoCount: 60
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0
- PK 组数：15
- 是否完成全部 PK：是

性能边界说明：
- 31.55 ms ~ 36.07 ms 只能说明 200 条元数据下的相似检测 / 分组 / 状态链路表现良好。
- 该结果不能代表真实大图读取、图片解码、Canvas 分析、缩略图渲染、浏览器内存压力或 ZIP 打包压力。
- 下一步应优先规划真实 100-300 张图片文件测试，而不是直接扩大 production 启用 true。
- 500+ 测试前必须先区分算法元数据测试与真实文件压力测试。

结论：
- 200 张中批量元数据 true 分支测试通过。
- 当前仍必须保持 USE_SIGNAL_GROUPS_FOR_BATTLE = false。
- 不允许默认启用 true。
- 不允许 production 启用 true。
- 下一步建议规划真实 100-300 张图片文件测试。
- 正式主流程仍保持 legacy。
