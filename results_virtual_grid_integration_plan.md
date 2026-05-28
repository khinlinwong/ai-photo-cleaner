# AI Photo Cleaner Results 虚拟网格代码接入与实现规划 - CORE-PERFORMANCE-4

## 一、 当前 results 页面结构分析

经过对 [src/app/results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 的只读审查，当前结果页的页面结构与业务逻辑具备良好的分层基础，可以直接进行虚拟网格接入。具体分析如下：

1. **照片列表变量名称**
   - **保留区数据源**：`keepPhotos` (第 280 行定义，通过 `photos.filter(...)` 提取 `getUserVisibleBucket(p) === 'keep'` 的照片)。
   - **淘汰候选区数据源**：`deletePhotos` (第 281 行定义，通过 `photos.filter(...)` 提取 `getUserVisibleBucket(p) === 'cull'` 的照片)。

2. **分区网格的渲染位置**
   - 页面中使用统一的 `renderPartitionGrid(items, partitionType)` 函数（第 372-477 行）渲染照片卡片网格。
   - 在 `ResultsPage` 返回的 JSX 树中：
     - 保留区挂载点：`{renderPartitionGrid(keepPhotos, 'keep')}` (第 710 行)。
     - 淘汰候选区挂载点：`{renderPartitionGrid(deletePhotos, 'cull')}` (第 726 行)。

3. **照片卡片包含的内容与高度约束**
   - 预览图：`<img>` 标签直接展示 `photo.url`（第 398-402 行），高度占满卡片顶部。
   - 问题/状态标签：使用 `renderIssueBadge(photo)`（第 403-405 行）定位悬浮展示。
   - 文件名称与大小：显示在一行，名称加粗截断，大小以 `font-mono` 呈现（第 411-414 行）。
   - 简单原因标签：展示 `getReasonTags(photo)`（第 417-421 行）。
   - 诊断与技术详情折叠：由 `<details>` 包裹（第 424-441 行），包含文本分值及点击触发 `openDetail(photo)` 的“开启像素诊断仪”链接。
   - 操作按钮：包含“保留”和“淘汰候选”两个按钮，绑定 `updatePhotoStatus(photo.id, 'keep' | 'delete')`。其样式取决于当前照片的分区归属。

4. **事件处理与解耦状态**
   - **操作事件来源**：照片卡片的点击和决断操作主要触发 `updatePhotoStatus`，均直接来源于上下文 Hook `usePhotoWorkspace()`（第 39-49 行）。
   - **ZIP 安全导出**：`downloadPhotosZip(status)` 方法（第 232-275 行）直接读取 `photos` 数组状态并进行物理过滤打包，完全不需要读取或操纵 DOM 树，与网格渲染是解耦的。
   - **Photo Battle 对战擂台**：作为全屏遮罩 Dialog 形式直接挂载在组件最外层（第 924-1221 行），通过 `activeBattle` 控制显示，其渲染、操作和过渡完全不依赖于底下的网格 DOM，与大列表网格展示完全解耦。

---

## 二、 规划组件拆分方式

为了确保本次重构的低风险性，我们将采用“业务渲染不变、DOM 层虚拟化替换”的策略，将组件进行局部拆分：

### 第一步：照片卡片抽离或 renderItem 复用
- 我们暂不直接改写卡片的 JSX 样式，而是将卡片整体作为虚拟网格的 `renderItem` 回调参数传入。
- 这样，所有的按钮状态、折叠框、事件逻辑都可以在 [src/app/results/page.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/app/results/page.tsx) 内部直接通过闭包引用处理，避免复杂的 props 级联传递。

### 第二步：新建独立通用的 VirtualPhotoGrid 组件
- 新建独立文件 `src/components/desktop/VirtualPhotoGrid.tsx`。
- `VirtualPhotoGrid` 是一个完全**无业务状态（Stateless）**、**类型通用（Generic）**的纯渲染组件。
- 它不应该知道什么是 `PhotoItem`，也不理解 `keep` 或 `cull` 分区，更不需要引用 `PhotoWorkspaceContext`、执行 ZIP 导出或触发 Photo Battle。它的唯一职责是：根据传入的列表项和容器滚动高度，只将视口可见的卡片渲染到屏幕上。

---

## 三、 规划 VirtualPhotoGrid props 接口

通用的 `VirtualPhotoGrid` 组件使用 TypeScript 泛型设计，其 props 规划如下：

```typescript
type VirtualPhotoGridProps<T> = {
  /** 待渲染的完整数据源列表（例如 keepPhotos 或 deletePhotos） */
  items: T[];
  /** 用于 React 渲染 key 的提取器（例如 (photo) => photo.id） */
  getItemKey: (item: T) => string;
  /** 每张卡片的具体渲染渲染函数（闭包复用现有的卡片 JSX） */
  renderItem: (item: T) => React.ReactNode;
  /** 每张卡片的最小宽度限制（例如 200px），用于自适应 CSS Grid 计算列数 */
  minCardWidth: number;
  /** 卡片的固定物理高度（例如 280px） */
  rowHeight: number;
  /** 网格卡片之间的间隙（例如 12px） */
  gap: number;
  /** 视口上方和下方安全预渲染的行数（建议设置为 2 到 4 行） */
  overscanRows?: number;
  /** 列表为空时的空状态组件（例如 暂无保留照片 的占位） */
  emptyState?: React.ReactNode;
};
```

---

## 四、 滚动与尺寸计算设计

自研的 `VirtualPhotoGrid` 主要依靠**外层容器监听 + 绝对定位撑高 / 动态 padding 撑高**来实现。

### 1. 核心计算公式
- **列数（Columns）计算**：
  在挂载和 window resize 时，通过容器 `containerRef.current.clientWidth` 获取当前网格宽度 `W`。
  $$\text{cols} = \max\left(1, \left\lfloor \frac{W + \text{gap}}{\text{minCardWidth} + \text{gap}} \right\rfloor\right)$$
- **总行数（Total Rows）计算**：
  $$\text{totalRows} = \lceil \text{items.length} / \text{cols} \rceil$$
- **可见行区间计算**：
  监听容器的 `scroll` 事件，获取当前 `scrollTop`。
  - 起始可见行：$$\text{startRow} = \max\left(0, \left\lfloor \frac{\text{scrollTop}}{\text{rowHeight} + \text{gap}} \right\rfloor - \text{overscanRows}\right)$$
  - 结束可见行：$$\text{endRow} = \min\left(\text{totalRows}, \left\lfloor \frac{\text{scrollTop} + \text{clientHeight}}{\text{rowHeight} + \text{gap}} \right\rfloor + \text{overscanRows}\right)$$

### 2. 占位与 DOM 撑起设计
- 外层使用一个相对定位的容器，并使用动态 CSS 高度表示网格真实总高度：
  $$\text{totalHeight} = \text{totalRows} * \text{rowHeight} + (\text{totalRows} - 1) * \text{gap}$$
- 为避免大量的绝对定位计算，可以通过动态计算网格的上下内边距（Padding）来把可见内容顶到正确的垂直区间上，简化 DOM 布局：
  - $$\text{topPadding} = \text{startRow} * (\text{rowHeight} + \text{gap})$$
  - $$\text{bottomPadding} = \max\left(0, \text{totalHeight} - \text{topPadding} - \text{visibleContentHeight}\right)$$
- 视口内仅渲染 `items.slice(startRow * cols, endRow * cols)` 中的元素，使用标准的 CSS grid 布局进行排布。

### 3. 边界与失效规避规划
- **Resize 监听**：在 React 中使用 `ResizeObserver` 监听容器尺寸变化，动态重新计算 `columns`。
- **列表长度突变处理**：当点击保留/淘汰迁移分类时，`items` 长度骤降。若此时 `scrollTop` 处于极高位置，极易造成滚动范围越界引发白屏。组件内部必须在 `items` 改变时判定 `scrollTop` 边界，必要时自动校正或重置。

---

## 五、 第一版暂不做的内容

为了保证逻辑闭环并排除变量干扰，第一版虚拟网格重构将坚持以下**不修改边界**：

1. **不做复杂 objectURL 懒回收系统**：在卡片移出视口时不频繁销毁/生成内存链接。频繁 revoke 会增加主线程重新解码大图的 CPU 开销，产生视觉闪烁。待虚拟网格基座稳定后，再统一考虑在 Desktop 全局销毁时释放内存。
2. **不引入任何第三方虚拟滚动库**（如 react-window、react-virtualized），确保零依赖。
3. **不修改核心感知聚类算法**（`duplicate.ts`）与**决策状态机 Context**。
4. **不改动 Photo Battle 对决擂台与 ZIP 打包**，其依然复用现有的状态和对象数据，不做任何虚拟化与多线程打包改造。

---

## 六、 固定高度卡片设计约束

因为虚拟网格依赖于固定的行高 `rowHeight`，所以照片卡片在各种分类状态下的视觉物理高度必须是绝对固定的：

1. 卡片的图片区域长宽比固定，如高度设置为硬编码的 `150px`。
2. 文字区域、Badge 区域均使用绝对高度和溢出隐藏保护。
3. 卡片内置的折叠技术详情 `<details>`，其内容展开后在第一版设计中建议**不要改变卡片本身的布局流高度**。如果允许卡片在网格内动态长高，会使自研虚拟滚动的坐标计算变得极度复杂。
   *规避设计*：在卡片设计中，将折叠详情信息限制在固定行数内，或者将技术详情以绝对定位的悬浮卡形式展示，不撑开父级卡片高度；或者在卡片中固定详情区高度，只允许在卡片内部的小区域中滚动查看，从而维持卡片总高度（例如 `290px`）为物理硬性常量。

---

## 七、 业务保持完全不变

代码接入后，以下机制必须保持 100% 对齐，不可产生任何非预期副作用：

1. **保留区/淘汰区数据来源不变**：依然使用 Context 中的 `photos` 状态。
2. **分类逻辑不变**：继续由 `getUserVisibleBucket(photo)` 单向决定。
3. **按钮动作行为不变**：点击保留/淘汰按钮，正常迁移分区并自动重新渲染。
4. **对决擂台逻辑不变**：在检测到 `needsBattle` 时自动弹出模态弹窗，操作流转和分类迁移完全一致。
5. **ZIP 安全导出不变**：导出的 ZIP 包中， winners 与 cullCandidates 的文件分区正确度 100% 无偏差。
6. **二值分类强制收敛**：用户分类继续维持“保留”与“淘汰候选”。

---

## 八、 后续 Checkpoint 路线规划

1. **`CORE-PERFORMANCE-3-QA`（接入点规划审查 - 已完成）**：
   - Codex 对接入点规划进行了只读审计，确认结构解耦清晰且无 src 代码脏修改。
2. **`CORE-PERFORMANCE-4`（最小虚拟网格实现与挂载 - 当前已完成）**：
   - 新建了独立无状态、泛型化的 `VirtualPhotoGrid.tsx` 组件，并将其集成 to results 页面中。
   - 重构了 results 页面列表渲染，将卡片抽取为 `renderPhotoCard` 并保持高度固定（`280px`），折叠技术详情改为绝对定位的悬浮气泡，保证列表滚动计算不受动态高度干扰。
   - 确认不改动 Context / 算法 / ZIP 导出 / Photo Battle，第一版不做 objectURL 懒销毁回收，无第三方依赖。

---

## CORE-PERFORMANCE-4 VirtualPhotoGrid 实现与回归结果

### 实现内容
- 新增 [VirtualPhotoGrid.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/components/desktop/VirtualPhotoGrid.tsx)。
- VirtualPhotoGrid 是零外部依赖的泛型虚拟网格组件。
- 组件不依赖 PhotoItem。
- 组件不读取 Context。
- 组件不理解 keep / cull。
- 组件不调用 ZIP。
- 组件不调用 Photo Battle。
- 组件只负责 UI 层虚拟渲染。
- results 页面将保留区 keepPhotos 与淘汰候选区 deletePhotos 分别传入 VirtualPhotoGrid。
- renderPhotoCard 负责保留原卡片 UI 和按钮行为。
- renderPartitionGrid 继续负责分区渲染入口。

### 回归结果
- Demo 流程正常。
- /processing 正常。
- /results 正常。
- 保留区 / 淘汰候选区正常。
- Photo Battle 正常。
- 卡片按钮正常。
- details 技术详情正常。
- details 悬浮气泡无遮挡、无裁切。
- ZIP 导出正常。
- 无新增报错。

### 100 张混合格式回归
- /processing 正常。
- /processing 耗时 9.39 秒。
- /results 正常。
- JPG / PNG / WebP 正常预览。
- 滚动流畅。
- 卡片无溢出。
- details 无遮挡、无裁切。
- Photo Battle 正常。
- ZIP 正常。
- 无第三最终分类。

### 300 张混合格式回归
- /processing 正常。
- /processing 耗时 33.79 秒。
- /results 正常。
- results 首次渲染正常。
- 滚动相比优化前更流畅。
- 未出现白屏。
- 卡片无溢出。
- details 无遮挡、无裁切。
- Photo Battle 正常。
- ZIP 正常。
- ZIP 和页面分区一致。
- 无第三最终分类。

### 布局检查
- 2 列正常。
- 3 列正常。
- 4 列正常。
- 无按钮挤压。
- 无标签撑高。
- 无 details 裁切。
- rowHeight={280} 与固定图片高度表现正常。

### 重要边界
- 本轮 console summary 没有成功捕获 QA 指标。
- oldSimilarGroupCount / newSimilarGroupCount / grouped photo count / leaderMismatchCount 本轮未读取。
- 原因是 headless 测试脚本在 SPA 路由跳转时注入 console 劫持时间点略晚。
- 因此本轮只确认 UI 虚拟网格、Photo Battle、ZIP 和二值分类流程正常。
- 不把本轮记录为 duplicate signal parity 重新验证，绝不夸大回归测试的验证证据。
- 后续已在 [qa_parity_output_plan.md](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/qa_parity_output_plan.md) 中正式规划了独立的 QA parity 输出方案，通过独立通道彻底解决此提取缺陷。

### 安全状态
- USE_SIGNAL_GROUPS_FOR_BATTLE 已恢复 false。
- git diff -- src/lib/config/featureFlags.ts 无 true 残留。
- 没有 package.json / package-lock.json 变动。
- 没有测试图片进入 Git。
