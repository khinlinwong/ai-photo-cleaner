# AI Photo Cleaner 稳定 QA Parity 输出规划 - CORE-PERFORMANCE-5-PLANNING

## 一、 当前问题记录

在进行真实图片（100张与300张）混合格式回归压力压测时，QA 指标读取被证实存在以下两类明显的不稳定性：
1. **React Fiber 树遍历极其不稳定**：由于 React 内部渲染机制在不同阶段及组件状态切换时其 Fiber 节点结构可能发生微调，测试脚本在不同时期依赖 Fiber 节点链式向上查找 Context 提取状态极易失效，常导致超时。
2. **SPA 路由后注入 console.debug 拦截时机偏晚**：SPA 页面内部在发生客户端路由跳转（如 `/processing` 导航到 `/results`）时，一些关键日志（如 `[Duplicate SimilarGroups QA]` 对比信息）可能在页面刚刚 Hydrated 时就已打印完毕。而测试脚本由于异步等待延迟，注入拦截时机偏晚，极易漏读 console 打印信息。
3. **CORE-PERFORMANCE-4 回归表现**：在上一阶段回归中，结果页 UI 渲染、Photo Battle 以及 ZIP 导出完全符合预期，但由于上述注入时机滞后原因，导致 console summary 抓取 Parity 指标失败，无法为聚类对齐提供客观的数字支撑。

因此，后续迫切需要规划一个更稳定、显式且专为开发与 QA 阶段量身定做的 dev-only QA parity 输出通道，彻底摆脱对 React Fiber 与 console 拦截时机的依赖。

---

## 二、 规划目标

设计和实现 QA parity 输出机制时，必须达成以下要求：
1. **只在 development 环境可用**：必须通过 development guard 确保 production 不写入。必须由 QA 验证 production 不暴露 `window.__AI_PHOTO_CLEANER_QA__`，不应仅依赖打包器剪枝作为安全保证。
2. **production 环境绝对不可见**：生产环境绝对不暴露任何与 QA 相关的数据流。
3. **不输出图片 base64**：绝不向输出对象写入任何图片的二进制或 Base64 编码数据。
4. **不输出本地文件路径**：绝不输出真实的绝对文件路径以防隐私泄露。
5. **不输出完整 photo 对象**：仅保留数字对比，不暴露大对象成员。
6. **只输出数字摘要**：仅输出相似组数量、相似照片总数、Leader 错配数等安全数字指标。
7. **不参与用户主流程**：输出逻辑与核心的 Context 和 results 渲染解耦，即使输出逻辑报错也绝对不影响页面功能。
8. **不影响 Photo Battle**：PK 擂台数据与该测试输出无关。
9. **不影响 ZIP**：ZIP 打包不引用该数据。
10. **不影响用户最终分类**：用户做出的保留/淘汰决定不受该数据干扰。
11. **不依赖 React Fiber**：测试脚本不需要去审查 React 树。
12. **不依赖 console 劫持时机**：即使日志已经打印过，状态信息依然持久保存在指定的全局通道中以供读取。

---

## 三、 规划可选方案

针对输出通道的设计，规划了以下三种可行方案：

### 方案 A：dev-only window 全局摘要对象（推荐方案）
在 `process.env.NODE_ENV === "development"` 环境下，在 Context 比对完双路数据或 Results 页面加载时，把最新的 `duplicateGroupQA` 对比指标写入到浏览器全局对象 `window.__AI_PHOTO_CLEANER_QA__` 中。
- **输出内容**：
  ```json
  {
    "oldSimilarGroupCount": 15,
    "newSimilarGroupCount": 15,
    "similarGroupCountMismatch": false,
    "oldSimilarGroupedPhotoCount": 60,
    "newSimilarGroupedPhotoCount": 60,
    "similarGroupedPhotoCountMismatch": false,
    "leaderMismatchCount": 0,
    "generatedAt": 1779941143307,
    "source": "duplicateGroupQA"
  }
  ```
- **优点**：最稳定，一旦写入即一直驻留在内存中。测试脚本可通过简单的定时轮询 window 属性的方式在任何时刻安全读取，不受 console 时间差与 React Fiber 链的局限。
- **风险**：必须强制做好 NODE_ENV 条件防阻断，避免其暴露在 production 环境，且 UI 组件严禁对其产生任何业务逻辑引用。

### 方案 B：页面隐藏 dev-only data 节点
在 results 页面 DOM 中渲染一个不可见的隐藏 DIV，例如 `<div id="dev-qa-parity" data-testid="dev-qa-parity-summary" style={{ display: 'none' }} data-qa={JSON.stringify(qaData)} />`。只在 development 阶段被包含进渲染。
- **优点**：测试脚本可以通过 DOM 渲染轻松提取属性，符合大部分 headless 浏览器的测试习惯。
- **风险**：需要在 results 页面的 TSX 组件树中塞入这个非业务专用的隐藏 DOM，对业务代码有轻微侵入性，且必须保证 production 不会被打包进去。

### 方案 C：继续 console summary，但提前注入
测试脚本在页面最初加载 `http://127.0.0.1:3000/desktop` 时便强制注入 console 拦截代理，即提前至 SPA 路由激活之前。
- **优点**：不改变任何业务源码。
- **风险**：依然属于时机敏感型，若 SPA 进行硬重构或者热更新导致页面刷新，原先注入的拦截代理可能在路由跳转后发生失效，稳定度依然较低。

---

## 四、 建议优先方案

**建议优先采用方案 A（dev-only window 全局摘要对象）**。
主要原因为其在提供 $100\%$ 的读取稳定性的同时，完全避免了在 results 页面插入隐藏 DOM 带来的代码杂质。测试脚本在进入 `/results` 页面后，可循环轮询读取该属性，只要在限定时间内属性存在即读取成功，是极佳安全隔离方案。

---

## 五、 规划实现边界

未来在实现方案 A 时，相关的改动范围必须极为克制：
- **涉及文件**：
  - [src/context/PhotoWorkspaceContext.tsx](file:///C:/Users/khinl/Documents/AI%20Photo%20Cleaner/src/context/PhotoWorkspaceContext.tsx)
- **实现规则**：
  - 必须使用逻辑包裹判断：
    ```typescript
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      (window as any).__AI_PHOTO_CLEANER_QA__ = qaSummary;
    }
    ```
  - 不可修改 Context value 中已有的核心决策属性。
  - 不可修改任何 objective 聚类算法。
  - 不可将 `window.__AI_PHOTO_CLEANER_QA__` 作为业务依赖传递给 Photo Battle、ZIP 或 results 渲染逻辑。

---

## 六、 规划测试脚本读取方式

测试脚本应更新为如下交互模式：
1. 导航进入 `/results` 页面后，直接执行 `window.__AI_PHOTO_CLEANER_QA__` 属性的轮询检测（例如每隔 500ms 检测一次）。
2. 判断 `window.__AI_PHOTO_CLEANER_QA__` 存在且包含合规的 number 类型的比对字段（例如 `oldSimilarGroupCount`、`newSimilarGroupCount` 及 `leaderMismatchCount` 均已生成）。其中 `generatedAt` 只用于新鲜度检查，不用于 parity 对比判断。
3. 如果在 30 秒内超时未出现，则判定为 QA parity 获取失败，不进行无限死锁轮询。
4. 测试完毕后自动将 Feature Flag 恢复为 `false` 并清理该全局属性。

---

## 七、 规划安全限制

实施时必须强制执行以下安全红线：
1. **禁止**在 production 生产环境输出任何 QA summary 对象或将其暴露在 window。
2. **禁止**在 QA summary 中写入真实的物理文件路径。
3. **禁止**在 QA summary 中包含图片的 Base64、元数据或图片 Blob。
4. **禁止**在 QA summary 中传递完整的照片实例对象及任何用户文件细节。
5. **禁止** UI 卡片与核心业务逻辑去读、写或监听该全局对象。
6. **禁止** ZIP 导出对该测试通道数据产生任何依赖。
7. **禁止** Photo Battle 对该数据产生任何依赖。
8. **禁止**把此 QA 对象当作长期的业务状态看待。

---

## 八、 规划后续 Checkpoint

1. **`CORE-PERFORMANCE-5-QA`**：Codex 对本 `qa_parity_output_plan.md` 规划文件进行只读审查，确保没有 src 代码脏改动且安全性隔离完整。
2. **`CORE-QA-PARITY-1`**（当前已完成）：已实现最小 dev-only 的 `window.__AI_PHOTO_CLEANER_QA__` 全局对象输出，输出字段仅为数字摘要与 `source` / `generatedAt` 等辅助新鲜度标记，production 环境不输出，且不包含任何物理文件路径、Base64/Blob 数据、完整 photo 实例以及用户文件细节。
3. **`CORE-QA-PARITY-1-QA`**：审查代码，确认完全隔离在 development 之下。
4. **`CORE-QA-PARITY-2`**（当前已完成）：配合新的 window 数据读取方式，对 100 张、300 张混合格式图片重跑灰度回归测试，通过 `window.__AI_PHOTO_CLEANER_QA__` 读取全部指标，且验证了 production 构建不暴露全局对象。

---

## 九、 记录 build/lint 环境问题

该类问题倾向于系统开发环境的缓存锁和僵尸进程冲突，**并非代码规则错误或 TypeScript 类型不合规**。
如果在后续验证中再次发生：
1. 应先执行 `Remove-Item -Recurse -Force .next` 清理缓存。
2. 通过任务管理器彻底清除残留的僵尸 Node.js 开发服务进程。
3. 重新运行构建，切忌为了迎合此环境缓存阻碍而对业务逻辑源码进行任何非必要修改。

---

## 十、 CORE-QA-PARITY-2 回归结果记录

development 100 张混合格式 parity 回归：
- `window.__AI_PHOTO_CLEANER_QA__` 成功读取。
- oldSimilarGroupCount: 3
- newSimilarGroupCount: 3
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 69
- newSimilarGroupedPhotoCount: 69
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0
- generatedAt 存在，仅用于新鲜度检查。
- source: duplicateGroupQA
- 输出只包含安全字段。
- 不包含路径、base64、Blob、完整 photo 对象、文件名、photoIds、EXIF、objectUrl、previewUrl。
- Photo Battle 正常。
- ZIP 正常。
- 没有第三最终分类。

development 300 张混合格式 parity 回归：
- `window.__AI_PHOTO_CLEANER_QA__` 成功读取。
- oldSimilarGroupCount: 6
- newSimilarGroupCount: 6
- similarGroupCountMismatch: false
- oldSimilarGroupedPhotoCount: 85
- newSimilarGroupedPhotoCount: 85
- similarGroupedPhotoCountMismatch: false
- leaderMismatchCount: 0
- generatedAt 存在，仅用于新鲜度检查。
- source: duplicateGroupQA
- 输出只包含安全字段。
- 不包含路径、base64、Blob、完整 photo 对象、文件名、photoIds、EXIF、objectUrl、previewUrl。
- Photo Battle 正常。
- ZIP 正常。
- 没有第三最终分类。

production 不暴露验证：
- npm run build 通过。
- production server 已启动并验证。
- production 下 typeof `window.__AI_PHOTO_CLEANER_QA__` 返回 undefined。
- 无控制台报错。
- 说明 development guard 生效，production 验证未暴露 QA summary。

字段名澄清：
- 正式字段名必须是 `window.__AI_PHOTO_CLEANER_QA__`。
- window.AI_PHOTO_CLEANER_QA 不是正式字段名。
- 用户测试回报中出现 window.AI_PHOTO_CLEANER_QA 属于文字表述问题，不是代码字段错误。
- 代码中未使用 window.AI_PHOTO_CLEANER_QA。

环境问题记录：
- Codex 环境中 build/lint 仍可能受 .next/cache 或 Node 进程占用影响。
- 这不是本轮代码错误。
- 后续如果遇到，应先清理 .next 或关闭占用 Node 进程。

---

## 十一、 CORE-DUPLICATE-SIGNAL-SWITCH-PLANNING 进展更新

- **后续回归读取标准**：本 `window.__AI_PHOTO_CLEANER_QA__` 开发环境隐藏输出将作为后续 signal switch (灰度开关) 重新验证与大批量/混合格式回归的唯一标准数据提取和检验源，替代了时机不稳定的 console 拦截或 React 节点深探方案，确保回归结论在当前回归中稳定可信。
- **真实相册感样本测试的应用**：在 `CORE-DUPLICATE-REALISTIC-ALBUM-PLANNING` 中规划的 100-300 张真实相册感非隐私样本测试，也将强制把 `window.__AI_PHOTO_CLEANER_QA__` 作为标准且唯一的 Parity 指标提取机制，验证双路算法结果的一致性。

---

## 十二、 CORE-DUPLICATE-REALISTIC-ALBUM 进展更新

- **在真实相册感样本测试中的成功应用**：`window.__AI_PHOTO_CLEANER_QA__` 已成功应用于 100 张和 300 张真实相册感非隐私样本测试。测试脚本通过该通道稳定、无漏读地读取了全部 Parity 摘要数据。
- **字段名与规范澄清**：
  - 正式代码字段名必须是 `window.__AI_PHOTO_CLEANER_QA__`，且测试过程严格验证了其正确性和稳定性。
  - 用户以及回归报告中所提到的 `window.AI_PHOTO_CLEANER_QA` 纯属文字性的通俗表述（即文字表述问题），而非实际代码所用字段，代码并未发生任何字段名的错写或混用。



