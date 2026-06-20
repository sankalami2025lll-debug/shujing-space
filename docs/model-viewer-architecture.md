# 统一模型浏览器架构（第一、二阶段 + UI 收口）

> 更新时间：2026-06-20  
> 第一阶段目标：先完成“统一壳子 + 引擎接口 + 分发结构”，不一次性接入全部模型引擎。  
> 第二阶段目标：先稳定“统一工具栏能力接口 + Shell 操作入口”，暂不接新的 GLB 引擎。  
> 当前详情页 UI：用户前端不显示开发说明模块与顶部标签栏，模型操作统一收口到视图内部左下角折叠工具栏。  
> 当前状态：模型浏览器 UI 收口、自检与无用代码清理已完成。  
> 当前原则：不改后端、不改数据库/Prisma、不改 OSS/ZIP 链路；LCC 详情页使用 iframe 独立页隔离 SDK 生命周期，外层只认统一完成协议。
> 最新口径：模型浏览器相关文档统一以 **阿里云 OSS** 为当前对象存储实现，文档内对象存储相关名称均按 OSS 口径理解。

## 一、为什么拆 ModelViewerShell

此前模型详情页把以下职责都写在单页里：

- 格式判断与 Viewer 分发
- LCC / iframe / 占位三套渲染分支
- 顶部操作按钮
- 底部工具按钮
- 模型信息切换与占位提示

这样会导致：

- 详情页持续膨胀，难以继续接入新格式
- 通用 UI 和具体引擎耦合
- LCC Viewer 容易被继续堆叠通用功能
- 后续 GLB / PLY / IFC / RVT / OSGB / 3DGS 难以独立演进

因此第一阶段改为：

- `ModelViewerShell` 负责**非 LCC 模型**的统一外壳
- 各 `Viewer` 只负责各自格式引擎
- `Toolbar / Tabs / InfoPanel / Loading / ErrorState` 归到 Shell 层

## 二、职责划分

### 1. ModelViewerShell

文件：`web/components/models/model-viewer-shell.tsx`

职责：

- 统一接收 `model`
- 根据 `getModelViewerKind(model)` 分发具体 Viewer
- 统一挂载 Viewer 与工具栏入口
- 统一管理全屏、重置视角的壳层行为
- 第二阶段将工具栏入口固定到 Viewer 区左下角，默认折叠，仅保留“工具”总入口
- 当前详情页不渲染开发说明模块、顶部标签栏、信息面板与占位面板
- 当前 **LCC / LCC2 不再直接经过 `ModelViewerShell`**，而是由详情页切到 `/viewer/lcc/[id]` iframe 独立页

明确不做：

- 不写 LCC SDK 初始化代码
- 不写 Three / IFC / Cesium / 点云等具体引擎逻辑
- 不在 Shell 内堆格式细节实现

### 2. ModelViewerToolbar

文件：`web/components/models/model-viewer-toolbar.tsx`

职责：

- 统一展示工具栏 UI
- 根据 `viewerCapabilities` 控制可用/禁用
- 第二阶段默认仅显示左下角“工具”入口按钮
- 点击后工具按钮向右横向展开，再次点击收起
- 第二阶段已接 `重置视角 / 全屏`
- 截图、旋转、平移、缩放、漫游、测量、标注、图层、信息当前仍为占位或禁用态

### 3. ModelViewerTabs

文件：`web/components/models/model-viewer-tabs.tsx`

职责：

- 提供统一 Tab 切换
- 当前 Tab：
  - 模型浏览
  - 模型信息
  - 文件结构
  - 操作记录
- 当前仅作为未来能力保留，不在模型详情页前端渲染

### 4. ModelInfoPanel

文件：`web/components/models/model-info-panel.tsx`

职责：

- 展示模型名称、格式、Viewer 类型、处理状态、分类、场景、描述
- 普通界面不展示过多技术字段
- 开发环境可折叠查看 `viewerUrl / allowIframe / processingError / status / visibility`
- 当前详情页模型信息由右侧详情栏承担，不在 `ModelViewerShell` 中渲染

### 5. Loading / ErrorState

文件：

- `web/components/models/model-loading-overlay.tsx`
- `web/components/models/model-error-state.tsx`

职责：

- `ModelLoadingOverlay` 继续作为统一品牌 Loading
- 不显示 LCC SDK 相关技术字段
- 所有格式都可以复用
- 最终统一规则为：黑底极简像素风，只保留 `Logo + 进度条 + 进度条下方跑步小人 + 右侧百分比`
- 不显示任何加载说明文字、引擎技术信息或额外装饰背景
- 当前不显示任何中文加载文案
- 加载专用 Logo 固定使用 `/brand/model-loading-logo.png`
- 跑步小人保留 4 帧像素动画，位于进度条下方
- 不在具体 Viewer 中重复实现 Loading，统一由 Shell 层复用同一组件
- `ModelErrorState` 用于统一接入中 / 暂不支持 / 处理中提示

### 6. Viewer Engines

目录：`web/components/models/viewers/`

当前阶段原则：

- 每种格式一个独立入口文件
- 引擎能力单独管理
- 先接目录结构和接口，不强行接复杂依赖

## 三、统一 Viewer 接口

文件：`web/components/models/viewers/types.ts`

已定义：

```ts
type ModelViewerHandle = {
  resetView?: () => void
  fitView?: () => void
  enterFullscreen?: () => void
  takeScreenshot?: () => Promise<string | void> | string | void
}

type ModelViewerCapabilities = {
  resetView: boolean
  zoom: boolean
  pan: boolean
  orbit: boolean
  walk: boolean
  measure: boolean
  annotation: boolean
  layer: boolean
  section: boolean
  screenshot: boolean
  fullscreen: boolean
}
```

当前默认能力：

- `lcc`：`resetView / zoom / pan / orbit / fullscreen`
- `iframe`：`fullscreen`
- 其它占位 Viewer：全部禁用

第二阶段补充约定：

- `ModelViewerShell` 只根据 `capabilities` 决定按钮是否可用
- 工具按钮若尚未接入，必须保持 `disabled`，点击不报错
- `takeScreenshot` 接口已预留，但本轮不强制实现真实截图

## 三点一、模型启动视图保存（第一阶段后端契约）

- 修改时间：`2026-06-06`
- 本轮范围：
  - `server/prisma/schema.prisma`
  - `server/prisma/migrations/*`
  - `server/src/modules/models/*`
  - `docs/model-viewer-architecture.md`
  - `docs/dev-checkpoint.md`
- 本轮不修改：
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/models/model-viewer-shell.tsx`
  - `web/components/models/model-viewer-toolbar.tsx`
  - `LCCRender.load(...)`
  - `dataPath`
  - `boundsCenterHomeView`
  - OSS / 上传 / `r2Key / objectKey` 兼容逻辑
- 后端新增字段：
  - `models.launch_view_json`
  - `models.launch_view_updated_at`
  - `models.launch_view_updated_by`
- 详情接口新增返回：
  - `launchView`
  - `canSaveLaunchView`
- 新增接口：
  - `PUT /api/models/:id/launch-view`
  - `DELETE /api/models/:id/launch-view`
- 当前权限规则：
  - 未登录写入/删除：`401`
  - 非模型归属用户写入/删除：`403`
  - 模型不存在或已删除：`404`
  - `launchView` 结构非法：`400`
  - 所有有权限查看该模型详情的用户都可读取 `launchView`
- 当前 `launchView` 契约：
  - `version = 1`
  - `viewerKind = "lcc"`
  - `snapshot = { position, target, up, near, far }`
- 本轮仅完成后端契约与接口：
  - `ModelViewerHandle` 尚未新增 `getCurrentView / applyView`
  - 左下角工具栏尚未接“保存启动视图”按钮
  - `LccViewer` 尚未在打开时优先应用 `launchView`
- 下一阶段前端接入原则：
  - `ModelViewerShell` 只负责调用 `viewerHandle.getCurrentView / applyView`
  - 具体视图读写仍由各 Viewer 自己实现
  - `LccViewer` 打开时的优先级应为：`launchView -> defaultCameraJson -> boundsCenterHomeView -> bounds`

## 三点二、模型启动视图保存（第二阶段前端接线）

- 修改时间：`2026-06-06`
- 本轮范围：
  - `web/lib/types.ts`
  - `web/components/models/viewers/types.ts`
  - `web/components/models/model-viewer-shell.tsx`
  - `web/components/models/model-viewer-toolbar.tsx`
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `docs/model-viewer-architecture.md`
  - `docs/dev-checkpoint.md`
- 本轮不修改：
  - `server/*`
  - `LCCRender.load(...)`
  - `dataPath`
  - `boundsCenterHomeView` 算法本体
  - Loading
  - 右侧详情栏
  - 顶部导航
- 前端新增类型：
  - `ModelLaunchView`
  - `ModelLaunchViewSnapshot`
  - `ModelDetail.launchView`
  - `ModelDetail.canSaveLaunchView`
- `ModelViewerHandle` 新增：
  - `getCurrentView()`
  - `applyView(view)`
- `LccViewer` 当前行为：
  - 打开模型优先级：`launchView -> defaultCameraJson -> boundsCenterHomeView -> bounds fallback`
  - `resetView` 回到当前最终默认视图；若已有保存的 `launchView`，则回到保存视图
  - `getCurrentView()` 直接读取 `camera.position / controls.target / camera.up / near / far`
  - `applyView(view)` 只接受合法 `launchView`，应用后同步更新 `defaultViewRef`
- 工具栏规则：
  - “保存启动视图” 位于左下角“工具”展开项内
  - 仅当 `canSaveLaunchView=true` 且当前 Viewer `capabilities.saveView=true` 时显示
  - 非归属用户不显示该按钮
- 保存流程：
  - 点击按钮后调用 `viewerHandle.getCurrentView()`
  - 前端调用 `PUT /api/models/:id/launch-view`
  - 成功后提示“启动视图已保存”
  - 成功后立即调用 `viewerHandle.applyView(view)`，无需刷新页面
- 当前接入范围：
  - 仅 LCC / LCC2
  - 暂不接 GLB / IFC / PLY / OSGB
  - 暂不接前台删除启动视图按钮

## 三点三、LCC iframe 独立页与完成协议（2026-06-12）

- 本轮新增独立路由：`web/app/viewer/lcc/[id]/page.tsx`
- 当前 LCC 查看链路已固定为：
  - `/models/[id]` 详情页识别 `isLccModel(...)`
  - 命中后详情页始终挂载 iframe：`/viewer/lcc/[id]`
  - iframe 内独立请求 `GET /api/models/:id`
  - iframe 内初始化 `LccViewer`
- 采用 iframe 的目的：
  - 隔离 `LCCRender` / `WebGLRenderer` / camera / controls 生命周期
  - 减少 React SPA 页面内反复挂载/卸载引发的上下文污染
  - 允许 `/models/[id]` 与 `/viewer/lcc/[id]` 分别采集运行时证据
- 外层详情页当前协议：
  - iframe 文档 load 后开始轮询子文档
  - 仅当子文档根节点满足：
    - `data-lcc-loaded="true"`
    - `data-lcc-complete-reason="onLoadedStable"`
  - 才收起外层唯一一层品牌 Loading
- 当前边界：
  - 外层详情页不解析 SDK 进度
  - 外层详情页不直接判断 canvas 是否已出画
  - 外层只消费子文档的统一完成协议

## 三点四、LCC 完成态与卡 92% 修复口径（2026-06-12）

- 真实故障现象：
  - 所有 LCC 模型在 `/models/[id]` 与 `/viewer/lcc/[id]` 中都可能停在约 92%
  - 运行时表现为 `viewerStatus=loading`、`data-lcc-loaded=false`
- 运行时结论：
  - 某些真实场景下 SDK `onLoaded` 未触发
  - 旧完成链过度依赖 `onLoaded -> stable window -> completeViewerLoading`
- 当前收口规则：
  - 正常路径仍优先使用 SDK `onLoaded`
  - 若 `onLoaded` 缺失，但 canvas 可见、资源窗口稳定、等待超过安全阈值，允许走安全兜底
  - 兜底后**仍写入**：
    - `data-lcc-loaded="true"`
    - `data-lcc-complete-reason="onLoadedStable"`
  - 外层协议保持不变
- 当前诊断属性：
  - `data-lcc-viewer-status`
  - `data-lcc-loaded`
  - `data-lcc-complete-reason`
  - `data-lcc-sdk-loaded`
  - `data-lcc-debug-*`
- 当前已知风险：
  - 外层详情页如果只看到 iframe 内 `error` 而不是 `loaded`，目前仍会继续显示 Loading

## 三点五、LCC 水印当前口径（2026-06-12）

- `XGRIDS` 水印当前判断不是普通 DOM，而是更接近 SDK / 授权链写入画布的品牌层
- 公开文档未查到正式“去水印 / 品牌控制”开关
- 当前仓库仅采用内部视觉处理，不视为官方去水印能力：
  - `LccViewer` 底部微裁切 `8px`
  - `viewerStatus === "loaded"` 后加 `16px` 底边
- 该方案仅用于内部展示，不修改 SDK 文件

## 四、Viewer 分发规则

文件：`web/lib/model-viewer-kind.ts`

当前规则如下：

### 1. LCC / LCC2 -> `lcc`

满足任一条件：

- `viewerType === "lcc"`
- `fileFormat === "lcc" | "lcc2"`
- `viewerUrl` 后缀为 `.lcc | .lcc2`

说明：

- `viewerType=native` 不会单独命中 `lcc`
- 只有原始格式本身明确为 `lcc/lcc2` 时才进入 `LccViewer`

### 2. GLB / GLTF -> `glb`

- `fileFormat === "glb" | "gltf"`
- 或 `viewerUrl` 后缀 `.glb | .gltf`

### 3. PLY -> `ply`

- `fileFormat === "ply"`
- 或 `viewerUrl` 后缀 `.ply`

### 4. BIM -> `bim`

- `fileFormat === "ifc" | "rvt"`

### 5. OSGB -> `osgb`

- `fileFormat === "osgb"`
- 或 `viewerUrl` 后缀 `.osgb`

### 6. iframe -> `iframe`

- `viewerType === "iframe" | "sketchfab"`
- 且 URL 不是 `.lcc / .lcc2 / .glb / .gltf / .ply / .ifc / .rvt / .osgb` 等原生入口

### 7. ZIP -> `zip`

- `fileFormat === "zip"`

说明：

- ZIP 不直接进入具体 Viewer
- 若是 LCC ZIP，后端处理成功后 `fileFormat` 应变成 `lcc / lcc2`

### 8. 其它 -> `unsupported`

- 未命中以上规则时进入 `UnsupportedViewer`

## 五、当前已接入与占位情况

### 已接入

- `LccViewer`
  - 核心逻辑仍在 `web/components/models/lcc-viewer.tsx`
  - `web/components/models/viewers/lcc-viewer.tsx` 只是转发出口
  - 第二阶段已通过 `forwardRef` 暴露 `resetView / fitView` 基础能力
- `IframeViewer`
  - 第一阶段支持真实 iframe 外链预览
  - 仍复用统一品牌 Loading

### 占位 Viewer

- `glb-viewer.tsx`
- `ply-viewer.tsx`
- `bim-viewer.tsx`
- `osgb-viewer.tsx`
- `unsupported-viewer.tsx`

占位要求已统一：

- 风格与现有 Viewer 背景一致
- 明确显示当前格式
- 提示“该格式在线预览引擎正在接入中”

## 六、LCC / LCC2 稳定规则

以下规则继续有效，不允许回退：

- 用户上传 ZIP 成果包
- 后端解压并保存 `.lcc / .lcc2` 入口文件 URL
- 前端 `LccViewer` 以入口文件 URL 作为 `dataPath`
- 不采用目录 `dataPath`
- 不依赖 `meta.lcc / meta.lcc2 / meta.splat`
- LCC / LCC2 共用同一个 `LccViewer`
- 已修复格式切换、StrictMode、单例污染与自检清理

第二阶段补充说明：

- `LccViewer` 仅新增 `forwardRef` 暴露基础操作能力，不修改核心加载时序
- `resetView` 已接入真实默认视角快照：
  - LCC / LCC2 当前统一优先级为：`defaultCameraJson -> boundsCenterHomeView -> bounds`
  - `boundsCenterHomeView` 使用模型中心点作为 `target`，相机朝向使用固定官方方向，不再依赖 `spawnPoint.rotation`
  - `spawnPoint` 只保留为 LCC 诊断元数据，不再决定默认打开视角
  - 不再使用 `poses` 轨迹筛选作为默认打开视角
  - `resetView` 只回到最终确认的默认快照来源，默认即 `boundsCenterHomeView`
- 默认视角算法继续只在 `LccViewer` 内维护：
  - `ModelViewerShell` 只调用 `resetView / fitView`
  - 不承载 LCC / LCC2 具体视角计算
  - 不把 LCC / LCC2 的 boundsCenterHomeView 扩散到其他格式 Viewer
- `fitView` 仍保留为基于当前已加载对象 / SDK bounds 的适配能力
- 未修改 `dataPath` 规则、`LCCRender.load` 参数结构、`unload / dispose / global load owner` 逻辑
- 各模型引擎默认视角仍由各自 Viewer 独立管理，未把 LCC / LCC2 视角逻辑外溢到其他格式
- 其他格式默认视角原则：
  - GLB：未来优先 glTF camera，否则使用 bounds
  - IFC / RVT：未来优先 BIM 引擎 home view，否则使用 bounds
  - PLY / 3DGS：未来优先点云 / 高斯 Viewer 默认视角，否则使用 bounds
  - OSGB / 3D Tiles：未来优先 tileset boundingVolume / Cesium camera
- `ModelViewerShell` 只负责调用各 Viewer 的 `resetView`，不承载任何具体视角算法

## 七、第二阶段工具栏接入情况

### 已接入按钮

- 重置视角：Shell 调用 Viewer `resetView / fitView`，LCC 当前会回到真实默认视角快照，而不是 remount
- 全屏：由 `ModelViewerShell` 对模型视图容器执行 `requestFullscreen / exitFullscreen`

### 占位 / 禁用按钮

- 截图
- 旋转 / 环绕
- 平移
- 缩放
- 漫游
- 测量
- 标注
- 图层
- 信息

说明：

- 当前这些按钮统一展示为禁用态，title 提示“暂未接入”
- 后续真实 `GlbViewer` 将直接复用同一套 `Toolbar / Shell / capabilities`，只需补 Viewer 句柄与能力声明

## 七点一、LCC / LCC2 真实操作控制第一版

- 修改时间：`2026-06-06`
- 本轮范围：
  - `web/components/models/model-viewer-shell.tsx`
  - `web/components/models/model-viewer-toolbar.tsx`
  - `web/components/models/model-viewer-help.tsx`
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/models/viewers/types.ts`
- 本轮不修改：
  - `server`
  - 数据库 / Prisma
  - OSS / 上传
  - `deploy`
  - `LCCRender.load(...)`
  - `dataPath`
  - `boundsCenterHomeView` 默认视角算法
  - `model-loading-overlay.tsx`
  - 右侧详情栏
  - 顶部导航
  - 模型详情页整体布局
- 当前规则：
  - 左键拖动：旋转视角
  - 右键拖动：平移视角（继续沿用 OrbitControls 现有行为，不单独重写）
  - 滚轮：缩放
  - `W / A / S / D`：前后左右移动
  - `Q / E`：下降 / 上升
  - `Shift`：加速
  - `R`：重置视角
  - `H`：打开 / 关闭帮助
  - `Esc`：关闭帮助
- 分工收口：
  - `ModelViewerShell` 只负责统一监听键盘事件，并把移动输入 / 速度倍率 / `resetView` / Help 开关转发给当前 Viewer
  - `LccViewer` 自己实现真实 camera movement：按当前相机方向计算 `forward/right/world up`，并同步平移 `camera.position + controls.target`
  - 其他格式 Viewer 若未实现对应句柄，则保持静默，不报错、不响应
- `ModelViewerHandle` 已补充接口：
  - `moveForward / moveBackward / moveLeft / moveRight / moveUp / moveDown`
  - `setMoveSpeedMultiplier`
  - `setMovementInput`
- 速度策略：
  - 继续基于当前模型 bounds 尺寸自适应
  - 当前在 `LccViewer` 内使用 `maxDim` 推导基础移动步长
  - `Shift` 为约 `3x` 速度倍率
- Help 入口位置：
  - 仍位于模型视图左下角现有“工具”模块展开项内
  - 不新增顶部帮助按钮
  - 不新增常驻说明面板
- 默认视角保持不变：
  - `resetView` 仍回到 `defaultCameraJson -> boundsCenterHomeView -> bounds`
  - 当前 `LCC / LCC2` 默认打开视角仍以 `boundsCenterHomeView` 为主链路
- 后续接入原则：
  - 其他格式 Viewer 继续复用同一套 `Shell -> handle -> capabilities` 结构
  - 由各自 Viewer 独立实现相机移动，不把 LCC 逻辑外溢到 Shell

## 七点二、帮助面板 + 第一人称鼠标交互（2026-06-20）

### 帮助面板 `ModelViewerHelp`

- 文件：`web/components/models/model-viewer-help.tsx`
- 入口：LCC 工具栏展开 → 帮助图标；快捷键 `H`
- UI：viewer 上方居中半透明暗罩浮层；Esc / 遮罩 / 右上角关闭
- 内容：仅 **第一人称** / **枢轴** 两个 tab；切换 tab **只展示对应操作说明**，不修改 viewer `controlMode`
- **不展示**：数字人、第三人称、新手指引、未接入能力说明

### 第一人称（`walk`）鼠标交互

实现位置：`web/components/models/lcc-viewer.tsx`（项目层；SDK 不提供）

| 输入 | 行为 |
|------|------|
| 左键拖动 | yaw/pitch 转头 |
| 滚轮 | 沿视线方向前后移动（不改 FOV） |
| 右键拖动 | 平移 `camera.position`（不改朝向） |
| WASD / Q / E / Shift | 键盘移动（Shell / iframe 页转发） |

- walk 下 **禁用** OrbitControls；orbit 仍用 OrbitControls（左旋转 / 滚轮缩放 / 右平移）
- 帮助打开时：`isHelpOpen` prop 屏蔽 walk 的 wheel 与 pointer

### UI 命名（内部枚举不变）

| 内部值 | 用户可见 |
|--------|----------|
| `walk` | **第一人称** |
| `orbit` | **枢轴**（工具栏模式按钮短文案可为「枢轴模式」） |

### 默认启动视图（已封板，与本节并行有效）

`launchView` → `sdkInitialCamera` → `explicitPackageDefaultView` / `defaultCameraJson` → `boundsCenterHomeView` → `bounds` / `sdkBounds`；`spawnPoint` 仅诊断。

## 八、当前详情页前端 UI 约束

- 用户前端不再显示“统一模型浏览器 / 外壳、标签、工具栏统一，具体引擎按格式独立接入”开发说明模块
- 当前详情页不显示顶部标签栏：`模型浏览 / 模型信息 / 文件结构 / 操作记录`
- `ModelViewerTabs / ModelInfoPanel` 暂作为未来能力保留，但当前不在详情页渲染
- `ModelViewerShell` 当前只负责：具体 Viewer 内容、Loading / Error 状态、视图内部左下角折叠工具栏
- 右侧模型详情信息继续由详情页右侧栏承担
- 当前用户页面不显示任何模型浏览器开发说明文案

## 九、收口自检结论

- 已确认：顶部开发说明模块、顶部标签栏、模型视图内部 `ModelInfoPanel`、文件结构面板、操作记录面板均不在当前详情页渲染
- 已确认：左下角折叠工具栏是当前唯一统一操作入口，不在顶部重复渲染
- 已确认：`ModelViewerTabs / ModelInfoPanel` 仅作为未来预留组件保留，避免后续能力接入时重复造轮子
- 已确认：统一 Loading 维持最终版本，仅保留 `Logo + 进度条 + 跑步小人 + 百分比`
- 已确认：LCC / LCC2 稳定规则、本地入口文件 `dataPath` 口径与生命周期保护逻辑不变

## 十、当前目录结构

```text
web/components/models/
├── lcc-viewer.tsx
├── model-error-state.tsx
├── model-info-panel.tsx
├── model-loading-overlay.tsx
├── model-viewer-shell.tsx
├── model-viewer-help.tsx
├── model-viewer-tabs.tsx
├── model-viewer-toolbar.tsx
└── viewers/
    ├── bim-viewer.tsx
    ├── glb-viewer.tsx
    ├── iframe-viewer.tsx
    ├── lcc-viewer.tsx
    ├── osgb-viewer.tsx
    ├── ply-viewer.tsx
    ├── types.ts
    ├── unsupported-viewer.tsx
    └── viewer-placeholder.tsx
```

## 十一、未来接入原则

后续接入 GLB / IFC / RVT / PLY / OSGB / 3DGS 时遵循：

- Viewer 引擎独立文件管理
- 不把通用能力塞进 `LccViewer`
- 通用外壳层统一品牌与交互结构
- 新引擎通过 `viewerKind + capabilities + handle` 接入
- 保持 `ModelDetailPage` 只传 `model` 给 Shell，不再写大段格式判断

## 十二、模型分享沉浸式观看页（2026-06-20）

- 新增独立路由：`web/app/models/[id]/view/page.tsx`
- 新增页面组件：`web/components/pages/model-share-viewer-page.tsx`
- 本次不修改已有 `/models/[id]` 详情页布局
- 分享链接改为 `/models/${id}/view`（修改 `model-detail-page.tsx` `handleShare` + `model-card.tsx` 分享按钮）

### 分享页 Viewer 规则

- 完全复用现有 LCC iframe 独立页 `/viewer/lcc/[id]`（由 /viewer/lcc/[id]/page.tsx 初始化 `LccViewer`）
- 不重复调用 `getModelDetail` 之外的 api
- 不直接初始化 `LCCRender`，不引入 LCC SDK
- 外层 Loading 复用 `ModelLoadingOverlay`，协议与详情页一致

### 全屏与横屏策略

- 页面 mount 500ms 后（等待 DOM 就绪）自动尝试 `requestFullscreen()` → `screen.orientation.lock("landscape")`
- 自动失败不报错、不白屏，设置 `showFullscreenButton = true`
- 降级态底部显示「进入横屏全屏观看」按钮 +「建议横屏观看」文字提示
- 用户点击按钮后再次执行全屏 + 锁横屏，仍失败则 toast 提示手动旋转
- 全屏目标 DOM：`#model-share-viewer-fullscreen-root`（仅 viewer 容器，不含信息栏）
- 退出全屏时执行 `screen.orientation.unlock?.()`
- 横屏 CSS：`landscape:max-h-dvh landscape:max-w-dvw`，不强制旋转页面

### 浏览器限制

- iOS Safari、微信内置浏览器、部分安卓浏览器自动全屏和锁横屏可能失败
- 方案通过 try/catch 静默兜底，不影响模型展示

## 十三、默认操作模式（2026-06-20）

- 所有模型页面默认操作模式从 `"orbit"`（观察模式）改为 `"walk"`（漫游模式）
- `ModelViewerShell` 的 `useState<ModelViewerControlMode>("orbit")` → `useState<ModelViewerControlMode>("walk")`
- `/viewer/lcc/[id]` 页面的初始化 + 模型切换重置也已同步改为 `"walk"`
- 工具栏按钮状态默认显示「漫游模式」，用户仍可切换回「观察模式」

## 十四、下一阶段建议

1. 为真实 `GlbViewer` 接入同一套 `handle + capabilities`
2. 评估截图接口是否由 Shell 统一截图容器，还是由具体 Viewer 输出原生截图
3. 为 BIM / PLY / OSGB 明确后续候选引擎和接入边界
4. 在"文件结构"Tab 中逐步接入不同格式的结构树
5. 在"操作记录"Tab 中沉淀统一事件模型
