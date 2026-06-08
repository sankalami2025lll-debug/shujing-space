# 统一模型浏览器架构（第一、二阶段 + UI 收口）

> 更新时间：2026-06-06  
> 第一阶段目标：先完成“统一壳子 + 引擎接口 + 分发结构”，不一次性接入全部模型引擎。  
> 第二阶段目标：先稳定“统一工具栏能力接口 + Shell 操作入口”，暂不接新的 GLB 引擎。  
> 当前详情页 UI：用户前端不显示开发说明模块与顶部标签栏，模型操作统一收口到视图内部左下角折叠工具栏。  
> 当前状态：模型浏览器 UI 收口、自检与无用代码清理已完成。  
> 当前原则：不改后端、不改数据库/Prisma、不改 OSS/ZIP 链路、不改 `LccViewer` 核心加载逻辑。
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

- `ModelViewerShell` 负责统一外壳
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

## 十二、下一阶段建议

1. 为真实 `GlbViewer` 接入同一套 `handle + capabilities`
2. 评估截图接口是否由 Shell 统一截图容器，还是由具体 Viewer 输出原生截图
3. 为 BIM / PLY / OSGB 明确后续候选引擎和接入边界
4. 在“文件结构”Tab 中逐步接入不同格式的结构树
5. 在“操作记录”Tab 中沉淀统一事件模型
