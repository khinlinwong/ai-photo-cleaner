# Design: Results & A/B Page UX Polish (Refined Scope)

This document outlines the UX polish design for the Results page and the A/B Comparison page of **AI Photo Cleaner**. Following the QA-LITE evaluation, the design scope has been narrowed to prioritize rapid keyboard selection efficiency and prevent performance overhead.

---

## 1. 当前 UX 问题清单 (Current UX Issues List)

### Results 页 (Results Page)
1. **保留/淘汰候选对比度不足**：虽然卡片有不同的边框颜色，但是在高分辨率或暗色主题下，"保留 (Keep)" 与 "淘汰候选 (Cull-Candidate)" 的视觉分层不够显著，快速浏览时不易一眼看清比例。
2. **多选图片模式禁用物理整理输出提示不明显**：在 `selected-files` (多选图片) 模式下，"本地整理输出" 按钮变灰，且只在其右侧显示一行绿色警告文本。该警告文本较长，且挤占了原本紧凑的标题操作区，视觉上显得冗余和不整洁。
3. **无相似组的展示体验单薄**：当未检测到相似照片组时，仅有一行蓝色的“未发现足够相似的照片组”提示，信息展示稍微单薄，没有提供用户总体跳过或失败统计的汇总。
4. **预览大图缺乏微交互**：卡片的主图片支持点击放大预览，但图片上没有任何悬停提示（如放大镜图标或文字提示），用户很难发现这是一个可以交互的入口。

### A/B 页 (A/B Comparison Page)
1. **缩放与拖拽操作缺乏冷启动引导**：支持鼠标滚轮缩放及左键拖动平移是一个极其强大的功能，但在没有用户提示（On-screen Guidance）的情况下，首次使用的用户完全不知道可以缩放和移动图片来对比细节。
2. **对局状态信息不够直观**：`当前组: 2 / 5` 的文本徽章过于静态，缺乏进度走势和“获胜者保留，挑战者替换”的对局规则简述，用户首次上手可能会对 AB 淘汰赛规则感到困惑。
3. **图像上的浮层干扰视线**：当前优选的 `👑 当前优选 [ ← ]` 和挑战图片的 `⚔️ 挑战照片 [ → ]` 徽章固定在图片上方。当需要对比边缘或角落细节时，这些徽章会遮挡画面。
4. **快捷键提示栏布局松散**：底部的 `<kbd>` 快捷键提示栏间距和边框样式略显简陋，缺乏精致感，与整体暗色极简设计风格不搭。

---

## 2. 推荐低风险 polish 项 (Recommended Low-risk Polish Items)

### Results 页
1. **Keep/Cull 低强度视觉区分**：
   - 采用温和、清晰的浅绿/浅红边框和底色暗示卡片归属。
   - 拒用大面积重度滤镜或深色模糊，防止增加页面分析几十张甚至几百张图片时的内存与渲染开销。
   - 坚决避免任何让用户误以为“已删除原图”的强视觉表达，Cull 状态在 UI 中严格保持“淘汰候选”的建议语义。
2. **selected-files 模式禁用 Tooltip**：
   - 移除标题右侧凌乱的警告字句。
   - 当用户将鼠标悬停在置灰的“本地整理输出”按钮上时，通过 `Tooltip` 或轻量 Popover 展示温和的说明，同时建议用户使用“导出清单”或“重新选择文件夹”。
3. **卡片大图预览 Hover 轻量提示**：
   - 在卡片图悬停时，居中展示一个非常轻量的半透明黑色遮罩，并带有一个小放大镜图标及“预览大图”文字。
   - Hover 遮罩的响应热区必须局限于图片内部，**绝对不能**遮挡或影响卡片右上角的 Checkbox 操作以及底部的“标记为淘汰候选/保留”按钮。
4. **统计卡片轻量激活状态**：
   - 给 4 个分类切换卡片添加微缩放按下回弹 (`active:scale-[0.98]`)。
   - 激活卡片使用轻量的主题色边框高亮，使其作为 Tab 切换的逻辑清晰直观。

### A/B 页
1. **缩放/拖拽首次微提示 (On-screen Guidance Overlay)**：
   - 在图片区域下侧展示极简的 `💡 滚轮缩放 / 拖拽平移 / 双击重置` 半透明标签。
   - 当用户进行首次缩放或拖拽后，该提示淡出隐藏，避免打扰用户后续对比。
2. **顶部细线进度条**：
   - 在 A/B 对比窗口顶部边缘增加一个精细细线进度条（使用 `Progress` 组件），指示当前相似组比对的轮次进度。
3. **徽章淡化而非隐藏 (Badge Fading)**：
   - 鼠标悬停在图片上或拖拽时，将 `👑 当前优选` 等徽章不透明度降低至 `opacity-20`（而不是完全隐藏），既防视线遮挡，又保留必要的基准参照。
4. **低调中性灰 (Neutral Grey) 快捷键提示**：
   - 放弃高调的 Dock 栏设计，将底部快捷键提示重构为极简中性灰背景和边框的 Dock，字体轻量，间距紧凑，使其作为低调的背景提示。

---

## 3. 降级与暂缓的项 (Deferred / High-risk Items)

为了保障极端场景下的性能和极致的手动键盘筛图流转效率，以下高风险或带延迟的视觉动效明确列入 **Deferred**，在第一阶段**坚决不实现**：
- ❌ **A/B 胜负滑入滑出动画**：不使用任何滑入滑出转场动画。A/B 对局的首要目标是快速判断图片，任何切组过渡动效都会拖慢用户的判断节奏，破坏“键盘流”用户的连击筛图效率。
- ❌ **大量 CSS filter (如 brightness-75)**：不在卡片网格中使用大规模的滤镜开销，以防造成大量照片渲染时的卡顿。
- ❌ **重发光投影与磨砂玻璃 Dock**：暂缓实现任何可能带来 GPU 渲染负荷的重度视觉元素，保持界面简洁扁平。
- ❌ **300ms 防抖及任何交互延迟**：键盘触发左/右/跳过决策时，状态流转和图片切换必须为 **0 延迟**（Instant-swap），坚决不引入防抖或延迟等待，保障每秒多次比对的顺畅感。
- ❌ **任何会降低快速键盘筛图效率的交互延迟**。

---

## 4. 产品安全边界 (Strict Product Boundaries)

在 UX Polish 过程中，必须严格遵守以下基础架构红线：
- ❌ **不新增 Review / Undecided 状态**，保持 Keep 与 Cull 二态。
- ❌ **不新增第三状态**。
- ❌ **不显示评分进入主决策视野**（评分仅限在像素诊断详情折叠内展示，不得放置到 A/B 主比对画面中）。
- ❌ **不使用“删除原图”语义**，强调只调整整理规划，原图保持不变。
- ❌ **不修改 Similar Groups 聚类算法**。
- ❌ **不修改 A/B 状态机逻辑**。
- ❌ **不显示真实路径 / 文件名**，继续使用 Photo-001。
- ❌ **不修改 installer / NSIS template**。
- ❌ **不影响 Native ZIP guard 与 copy-only / report schema 逻辑**。

---

## 5. 实现阶段拆分 (Implementation Phases)

- **Checkpoint A**: `CORE-DESKTOP-NATIVE-RESULTS-LOW-RISK-UX-POLISH-1`
  - selected-files 禁用 tooltip 悬浮框。
  - preview hover 放大镜轻提示。
  - 统计卡片轻量 active 高亮边框。
  - Keep / Cull 轻量低强度视觉区分（边框与底色，不做大量 filter 滤镜）。
- **Checkpoint B**: `CORE-DESKTOP-NATIVE-AB-LOW-RISK-UX-POLISH-1`
  - 缩放 / 拖拽 / 双击重置首次极简提示。
  - 顶部细线进度条。
  - 徽章淡化（opacity-20）。
  - 低调快捷键中性灰提示 Dock 栏。
  - 不改状态机，不加任何切换动画。
- **Deferred / Later**:
  - A/B 胜负滑入滑出转场动画。
  - 大量 CSS filter 渲染。
  - 磨砂玻璃 Dock。
  - 键盘操作 Debounce 与延迟切组。

---

## 6. 验收测试清单 (Acceptance Testing Checklist)

- [ ] **Results 页面卡片对比**：开启 Results 页，确认 Keep 状态与 Cull 状态的卡片有清晰但轻量温和的边框与底色区分，无卡顿。
- [ ] **大图预览提示**：将鼠标悬停在 Results 卡片图片上，确认显示了“预览大图”轻量遮罩与放大镜图标，且完全不干扰 Checkbox 鼠标热区。
- [ ] **多选图片模式禁用提示**：在上传页多选几张图片（非文件夹）进行分析，进入 Results 页后，确认“本地整理输出”按钮为灰色不可点，且鼠标悬停时会弹出 Tooltip，顶部无凌乱警告。
- [ ] **A/B 页面徽章遮挡**：在 A/B 对局中，确认将鼠标悬停在对比图片上或拖动图片时，上方的优选/挑战徽章降为低不透明度（`opacity-20`），不完全消失但保证不挡细节。
- [ ] **缩放拖拽引导**：首次打开 A/B 页面时，确认能看到 `滚轮缩放 / 拖拽平移` 简易操作引导，拖拽后自动淡出。
- [ ] **键盘响应速度**：使用键盘方向键快速决策，确认下一张切换是瞬时的，无任何延迟或转场动画阻塞。

---

## 7. 后续 checkpoint 建议 (Next Checkpoints Recommendations)

- **Checkpoint A (实现阶段一)**：`CORE-DESKTOP-NATIVE-RESULTS-LOW-RISK-UX-POLISH-1`
- **Checkpoint B (实现阶段二)**：`CORE-DESKTOP-NATIVE-AB-LOW-RISK-UX-POLISH-1`
