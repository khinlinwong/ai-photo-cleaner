# Design: Results & A/B Page UX Polish

This document outlines the UX polish design for the Results page and the A/B Comparison page of **AI Photo Cleaner**. The goal is to refine the user interaction paths, visual indicators, and micro-guidance to make the application feel like a premium, state-of-the-art desktop experience before release.

---

## 1. 当前 UX 问题清单 (Current UX Issues List)

### Results 页 (Results Page)
1. **保留/淘汰候选对比度不足**：虽然卡片有不同的边框颜色，但是在高分辨率或暗色主题下，"保留 (Keep)" 与 "淘汰候选 (Cull-Candidate)" 的视觉分层不够显著，快速浏览时不易一眼看清比例。
2. **多选图片模式禁用物理整理输出提示不明显**：在 `selected-files` (多选图片) 模式下，"本地整理输出" 按钮变灰，且只在其右侧显示一行黄色警告文本。该警告文本较长，且挤占了原本紧凑的标题操作区，视觉上显得冗余和不整洁。
3. **无相似组的展示体验单薄**：当未检测到相似照片组时，仅有一行蓝色的“未发现足够相似的照片组”提示，信息展示稍微单薄，没有提供用户此次分析的总体跳过或失败统计汇总。
4. **预览大图缺乏微交互**：卡片的主图片支持点击放大预览，但图片上没有任何悬停提示（如放大镜图标或文字提示），用户很难发现这是一个可以交互的入口。

### A/B 页 (A/B Comparison Page)
1. **缩放与拖拽操作缺乏冷启动引导**：支持鼠标滚轮缩放及左键拖动平移是一个极其强大的功能，但在没有用户提示（On-screen Guidance）的情况下，首次使用的用户完全不知道可以缩放和移动图片来对比细节。
2. **对局状态信息不够直观**：`当前组: 2 / 5` 的文本徽章过于静态，缺乏进度走势和“获胜者保留，挑战者替换”的对局规则简述，用户首次上手可能会对 AB 淘汰赛规则感到困惑。
3. **图像上的浮层干扰视线**：当前优选的 `👑 当前优选 [ ← ]` 和挑战图片的 `⚔️ 挑战照片 [ → ]` 徽章固定在图片上方。当需要对比边缘或角落细节时，这些徽章会遮挡画面。
4. **快捷键提示栏布局松散**：底部的 `<kbd>` 快捷键提示栏间距和边框样式略显简陋，缺乏精致感，与整体暗色极简设计风格不搭。

---

## 2. 推荐 polish 项 (Recommended Polish Items)

### Results 页
1. **增强卡片状态视觉暗示 (Card State Styling)**：
   - 保留卡片（Keep）：使用非常微弱的绿色渐变背景 (`bg-emerald-950/10`) 及微微发光的底边边框。
   - 淘汰卡片（Cull）：使用微弱的红褐色背景 (`bg-rose-950/10`)，并将图片亮度降低 15%（使用 CSS filter: `brightness-75`），使得“淘汰候选”的卡片在视觉上呈暗色“被淘汰”状态，极大增强可视性。
2. **优化 selected-files 模式禁用信息展现**：
   - 移除标题右侧凌乱的警告文本。
   - 当用户将鼠标悬停在已禁用的 "本地整理输出" 按钮上时，通过 `Tooltip` 或精美的小弹窗展示温和的说明，同时建议用户使用“导出清单”或“重新选择文件夹”功能。
3. **添加大图预览悬停交互 (Magnifier Indicator)**：
   - 在卡片图片悬停时，居中显示一个微渐显的半透明黑色遮罩，并带有一个放大镜图标 (`Maximize2` 或 `Search`) 和 "预览大图" 字样，提示用户此处可点。
4. **优化 ResultsSummaryCards 的激活状态与微动画**：
   - 给 4 个分类切换卡片添加平滑的微缩放效果 (`active:scale-[0.98]`)。
   - 激活的卡片使用主题发光投影（`shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]`）并高亮其对应的图标，使得页面重心非常聚焦。

### A/B 页
1. **新增缩放与平移微指引 (On-screen Guidance Overlay)**：
   - 在对比区域下方或图片角落放置半透明极简微标签：`💡 滚轮缩放 / 拖拽平移 / 双击重置`，在用户进行首次缩放后，此提示可通过淡出效果隐藏，以保证观图体验。
2. **悬停自动隐藏图片标注徽章 (Auto-hide Overlays)**：
   - 对 `👑 当前优选` 和 `⚔️ 挑战照片` 的标记徽章进行优化，当用户鼠标移入图片区域或开始拖拽时，徽章不透明度降低至 10%（`opacity-10`）或完全隐藏，确保用户看图时 100% 无遮挡。
3. **优化 A/B 进度指示与动效 (Progress & Matchup Indicators)**：
   - 在顶部栏添加一个精致的细线进度条 (`Progress` 组件)，指示当前组的对决进度。
   - 对单局决策（Keep Left / Keep Right）增加滑出与滑入的平滑过渡（例如：左侧获胜时，右侧卡片向下淡出，新挑战卡片从右侧平滑滑入，代表“优选保留，挑战继续”的竞技场感觉）。
4. **重构底部快捷键提示栏 (Shortcuts Dock)**：
   - 设计为悬浮在屏幕底部中央的磨砂玻璃 Dock 栏 (`backdrop-blur-md bg-black/40 border border-white/5 px-4 py-1.5 rounded-full`)，使用字重轻量、色彩和谐的布局，提高科技感。

---

## 3. 不建议改的项 (Not Recommended Changes)

为了确保软件的基础架构稳定以及安全边界，以下行为在本轮 polish 中**坚决避免**：
- ❌ **不要新增第三状态**：严禁引入 “Review”、“Undecided (未决定)” 等第三状态。照片处理状态必须依然保持严格的 `Keep` 与 `Cull`（展示为“淘汰候选”）两极分化，状态机不作调整。
- ❌ **不要显示评分**：不要在 A/B 对比界面直接显示 95、87 等具体分数值。A/B 对比的本质是鼓励用户凭借主观视觉感知进行二选一挑选，显示客观分数值会严重干扰用户的主观决策。
- ❌ **不要使用“删除原图”语义**：在 UI 任何地方严禁使用“物理删除”、“删除原图”等词汇，应继续统一表述为“标记为淘汰候选”、“整理输出”，以防用户产生丢失数据的恐惧感。
- ❌ **不要修改 Similar Groups 算法**：照片相似性聚类算法属于稳定的底层算法，本次只修改视觉引导，不改动聚类逻辑。
- ❌ **不要修改 A/B 状态机逻辑**：`PhotoWorkspaceContext` 中的 `applyBattleDecision` 以及 contenderIndex 流转属于核心稳定逻辑，不应改动，所有转场效果纯在 View 层通过 React CSS 动画实现。

---

## 4. 分阶段实现建议 (Phase-by-phase Implementation Plan)

### 第一阶段：视觉基础与 Results 页面 Polish (Phase 1)
- 优化 `ResultsPhotoCard` 的 Keep/Cull 卡片样式、微光效果。
- 增加大图预览的 Hover 遮罩及放大镜提示。
- 实现 `selected-files` 模式下 "本地整理输出" 按钮的禁用 Tooltip 交互，移除顶部的冗余文字。
- 美化 `ResultsSummaryCards` 的激活与投影状态。

### 第二阶段：A/B 页面细节与动效 Polish (Phase 2)
- 在 A/B 对比窗口上方实现精致的细线进度条。
- 将底部快捷键提示重构为悬浮式磨砂玻璃 Dock。
- 实现鼠标悬浮在图片上时，自动淡出隐藏 `👑 当前优选` 等覆盖徽章的交互。
- 增加 A/B 对局中鼠标缩放平移的常驻/动态隐藏微指引。
- 优化 A/B 获胜与切换时的 React CSS 平滑入场/退场动画。

---

## 5. 验收测试清单 (Acceptance Testing Checklist)

- [ ] **Results 页面卡片对比**：开启 Results 页，确认 Keep 状态与 Cull 状态的卡片有极高辨识度，Cull 状态卡片有显著变暗及红褐色倾向。
- [ ] **大图预览提示**：将鼠标悬停在 Results 卡片图片上，确认显示了“预览大图”半透明遮罩与放大镜图标，点击可顺利放大。
- [ ] **多选图片模式禁用提示**：在上传页多选几张图片（非文件夹）进行分析，进入 Results 页后，确认“本地整理输出”按钮为灰色不可点，且鼠标悬停时会弹出清晰的提示框，顶部无长篇大论的凌乱警告。
- [ ] **A/B 页面徽章遮挡**：在 A/B 对局中，确认将鼠标悬停在对比图片上或拖动图片时，上方的优选/挑战徽章自动隐藏或淡出，不阻碍图片细节观察。
- [ ] **缩放拖拽引导**：首次打开 A/B 页面时，确认能看到常驻或渐隐的 `滚轮缩放 / 拖拽平移` 简易操作引导。
- [ ] **安全边界检查**：确认 UI 中绝无“删除原图”的危险词汇，且在 A/B 对比主页面上未显示具体的 AI 评分，只在详情像素诊断仪中提供评分。

---

## 6. 后续 checkpoint 建议 (Next Checkpoint Recommendations)

- **推荐下一个 Checkpoint**：`CORE-DESKTOP-NATIVE-RESULTS-AB-UX-POLISH-IMPLEMENT-1` (执行 results 和 ab 页面 UX polish 的代码实现)。
