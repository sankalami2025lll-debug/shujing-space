> 记录日期：2026-06-12（持续补记至 2026-06-21）
> 记录范围：LCC Web SDK 接入、运行时升级、Viewer 交互与文档口径。
> 明确未改范围：`server/`、数据库、OSS、`deploy/.env.prod`（除非各节单独说明）。
> 最新口径：当前对象存储实际为 **阿里云 OSS**；文档统一使用 `OSS_* / objectKey / oss-compatible.service.ts` 作为对象存储命名。
> **优先读本节**：下方「当前运行时口径（0.6.1）」为 web 实际加载依据；第 1～11 节含 0.6.0 历史接入记录，勿与运行时混淆。

## 当前运行时口径（0.6.1，2026-06-20）

| 项 | 值 |
|---|---|
| SDK 版本 | **0.6.1**（UMD 内嵌版本字符串 `"0.6.1"`） |
| 部署目录 | `web/public/vendor/lcc-web/0.6.1/` |
| 文件名 | `lcc-web-sdk.js`（ESM）、`lcc-web-sdk.umd.js`（UMD） |
| **非**运行时文件名 | ~~`lcc-0.6.1.js`~~、~~`lcc-0.6.0.js`~~（历史/误称，仓库内不存在于 `web/public`） |
| 运行时加载 URL | `/vendor/lcc-web/0.6.1/lcc-web-sdk.umd.js` |
| 代码常量 | `LccViewer` 内 `LCC_WEB_VERSION = "0.6.1"` |
| 官方对照包 | `LCC-Web-0.6.1/` → `sdk/lcc-web-sdk.js` |
| LCCRender 公开 API | `load`、`setCamera`、`update`、`unload`、`dispose`、`raycast`、`raycastFromOrigin`、`clearIndexDB`、`getVersion` |

**说明**：SDK 只负责 LCC 场景渲染；walk / orbit 相机与鼠标交互均在项目层 `lcc-viewer.tsx`（walk 自研 + orbit 用 Three.js `OrbitControls`）。

### 默认启动视图优先级（已封板）

`launchView` → `sdkInitialCamera` → `explicitPackageDefaultView`（含 `defaultCameraJson`）→ `boundsCenterHomeView` → `bounds` / `sdkBounds`

`spawnPoint` 仅 dev 诊断，不参与 defaultView / `resetView`。

---

## 1. SDK 原始路径（历史：0.6.0 首次接入）

- 原始目录：`C:\Users\13114\Desktop\公司网站开发\公司官网首页设计\LCC-Web-0.6.0`

## 2. SDK 分发形式判断

- 该目录**不是 npm 包**：根目录无 `package.json`，不属于直接 `npm install` 的发布物。
- 该目录更接近**静态 SDK 发布包 + demo 示例工程**：
  - `sdk/` 下提供可直接引用的 SDK 文件：
    - `lcc-0.6.0.js`
    - `lcc-0.6.0.umd.js`
  - `examples/` 下提供示例入口：
    - `three.html`
    - `cesium.html`
  - `examples/engine/` 下包含示例运行时依赖（Three / Cesium 静态资源）。
- 结合 `README_zh.md`，官方推荐方式是本地静态服务运行 examples，因此当前判断为：**离线静态 dist 包，附带 demo 示例工程**。

## 3. 已复制 SDK 文件

- 复制目标目录：`web/public/vendor/lcc-web/0.6.0/`
- 已复制文件：
  - `web/public/vendor/lcc-web/0.6.0/lcc-0.6.0.js`
  - `web/public/vendor/lcc-web/0.6.0/lcc-0.6.0.umd.js`
- 当前**未复制**：
  - `examples/engine/three/*`
  - `examples/engine/cesium/*`
  - `assets/*`
- 原因：本阶段只做打开动画和 Logo 品牌化准备，**不做模型解析，不做 worker，不接真实引擎运行时**。

## 4. 新增文件

### 接入阶段新增

- `web/public/vendor/lcc-web/0.6.0/lcc-0.6.0.js`
- `web/public/vendor/lcc-web/0.6.0/lcc-0.6.0.umd.js`
- `web/components/models/lcc-viewer.tsx`

### 文档补录阶段新增

- `docs/lcc-web-sdk-integration.md`

## 5. 修改文件

- `web/components/pages/model-detail-page.tsx`
- `docs/dev-checkpoint.md`（仅追加索引）

## 6. LccViewer 当前能力

- 组件位置：`web/components/models/lcc-viewer.tsx`
- 当前能力仅限**统一 Viewer 外壳**与**品牌化准备**：
  - 统一承接 LCC / LCC2 的前端入口组件；
  - 从 `/vendor/lcc-web/0.6.0/lcc-0.6.0.umd.js` 预加载 SDK；
  - 展示数境空间 Logo、品牌化打开动画和 SDK 状态；
  - 根据 `viewerUrl` / `fileFormat` 推断当前模型属于 `LCC` 还是 `LCC2`；
  - 在未接真实解析前，保留外部源地址查看入口。
- 当前**不包含**：
  - `LCCRender.load(...)` 真正加载模型；
  - worker 初始化；
  - Three / Cesium 引擎运行时接入；
  - 相机控制、重置视角、测量、拾取、进度事件桥接。

## 7. LCC / LCC2 统一处理方式

- 当前统一策略为：**模型详情页只负责识别，实际展示统一走 `LccViewer`**。
- 模型详情页识别逻辑：
  - `viewerType === "native"` 时优先走 `LccViewer`；
  - 若 `fileFormat` 或 `viewerUrl` 命中 `lcc` / `lcc2`，也走 `LccViewer`。
- `LccViewer` 内部再根据 `viewerUrl` / `fileFormat` 推断模式：
  - 命中 `lcc2` 视为 `LCC2`
  - 其他按 `LCC` 处理
- 后续真实接入时，仍保持**页面层只挂一个统一组件**，由组件内部决定：
  - 加载参数差异；
  - 引擎差异；
  - 能力开关差异。

## 8. 当前未完成内容

- 未确认真实运行时到底采用：
  - `three` npm 依赖；
  - 还是继续静态托管 `examples/engine/three`；
  - 或者后续转 Cesium 路线。
- 未接 `LCCRender.load(...)` 实际加载流程。
- 未复制 examples 的 `engine` 目录，因此当前不具备真实渲染条件。
- 未接 worker。
- 未接模型解析状态与真实加载进度联动。
- 未将“重置视角 / 全屏 / 漫游 / 测量”按钮绑定真实 viewer API。
- 未验证 LCC2 是否需要与 LCC 不同的底层初始化参数。

## 9. pnpm build 验证结果

- 验证命令：`cd web && pnpm build`
- 结果：**通过**
- 说明：
  - Next.js 生产构建完成；
  - 新增 `LccViewer` 与详情页最小接入未引入编译错误；
  - 构建中存在若干**既有 warning**（如部分页面使用 `<img>`、个别未使用变量），与本次 LCC SDK 第一步接入无直接关系。

## 10. 下一步计划

1. 明确真实运行时路线：优先确认后续使用 `three` npm 依赖，还是静态托管 `examples/engine/three`。
2. 在 `LccViewer` 内正式接入 `LCCRender.load(...)`，仅在 `native + ready` 状态下初始化。
3. 确认模型详情接口对 LCC / LCC2 的字段约定，至少固定：
   - `viewerType`
   - `viewerUrl`
   - `fileFormat`
   - 后续如需要再补 `metadataUrl` / `engineType`
4. 将详情页现有“重置视角 / 全屏”等按钮与 `LccViewer` 对外暴露的方法打通。
5. 如 SDK 真实运行要求静态资源目录，再补最小必需的 `engine` 文件，而不是整包无差别复制。

## 11. 备注

- 本次记录对应的是**LCC Web SDK 第一步接入**，目标是先把 SDK 目录结构判断清楚，并把统一组件和静态资源入口准备好。
- 本次没有继续扩展业务逻辑，也没有修改后端、数据库、OSS 或部署环境文件。

---

## 12A. 开发记录（2026-06-12：LCC iframe 独立查看器与卡 92% 修复）

- 本次目标：
  - 将 LCC/LCC2 详情查看从详情页内直挂收口为 iframe 独立页
  - 真实排查“所有 LCC 模型卡在 92%”问题
  - 在不改后端 / 数据库 / SDK 文件的前提下完成最小修复
- 关键文件：
  - `web/app/viewer/lcc/[id]/page.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/models/model-loading-overlay.tsx`
- 当前链路：
  - `/models/[id]` 命中 LCC 后始终挂载 iframe `/viewer/lcc/[id]`
  - iframe 内单独请求 `GET /api/models/:id`
  - `LccViewer` 将完成态写入根节点：
    - `data-lcc-viewer-status`
    - `data-lcc-loaded`
    - `data-lcc-complete-reason`
    - `data-lcc-sdk-loaded`
  - 详情页外层只在 `data-lcc-loaded=true && data-lcc-complete-reason=onLoadedStable` 时关闭唯一品牌 Loading
- 真实根因：
  - 问题不是单个模型数据损坏
  - 真实运行时中，SDK `onLoaded` 会偶发不触发
  - 原链路过度依赖 `onLoaded -> stable window -> completeViewerLoading`
  - 结果是模型资源已下载，但无法到达完成态
- 当前修复策略：
  - 保留原 `onLoadedStable` 协议不变
  - 当 `onLoaded` 缺失，但画布可见、资源窗口稳定、等待超过安全阈值时，允许走安全兜底
  - 兜底仍调用 `completeViewerLoading("onLoadedStable")`
  - 因此外层无需改协议
- 当前运行时验证结果：
  - `/models/77`
  - `/viewer/lcc/77`
  - 额外抽测模型
  - 均已验证不再长期停在 92%，且 `data-lcc-loaded=true`
- 当前已知风险：
  - 外层详情页只认 `loaded + onLoadedStable`；若子文档进入 `error`，外层仍会继续显示 Loading，错误态会被遮住

## 12B. appKey 验证结论（2026-06-12）

- 当前环境变量为：`NEXT_PUBLIC_LCC_APP_KEY` 未注入
- 真实抓取中：
  - `data-lcc-debug-appkey="absent"`
  - 故障仍可稳定复现并被修复
- 当前结论：
  - 本轮“卡 92%”与 appKey 缺失无直接关系
  - 业务侧继续保持“无 appKey 时不传 `appKey` 字段”的条件展开
  - 暂未发现 `...(LCC_APP_KEY ? { appKey: LCC_APP_KEY } : {})` 对本轮故障构成决定性影响

## 12C. 水印来源与品牌控制结论（2026-06-12）

- 真实页面检查结论：
  - `XGRIDS` 未作为普通 DOM 文本节点出现
  - 更接近 SDK / 授权链输出到 canvas 的品牌层
- 官方资料检查结论：
  - 公开文档未查到正式“去水印 / 品牌控制”方案
  - 但 SDK 产物内存在 `appKey / waterMark / isVerifySig` 相关内部字段，说明水印更像授权链行为
- 当前口径：
  - 不能把“直接删水印”视作公开支持的前端能力
  - 若需正式去除，应优先向 XGRIDS 官方确认授权等级与 `appKey` 能力

## 12D. 当前内部视觉处理（2026-06-12）

- 仅内部前端视觉处理，不修改 SDK：
  - `LCC_WATERMARK_CROP_PX = 8`
  - `LCC_WATERMARK_BOTTOM_BAR_PX = 16`
- 实施位置：
  - `web/components/models/lcc-viewer.tsx`
- 实施方式：
  - `mountRef` 所在画布区域通过 `overflow-hidden` 做底部微裁切
  - 在 `viewerStatus === "loaded"` 后附加一条 `16px` 底边
- 当前状态：
  - 该方案仅作为内部视觉收口存在
  - 不是官方去水印方案

---

## 12. 开发记录（第二步：最小真实加载器接入）

- 修改时间：`2026-06-04 21:19:06`
- 本次目标：将 `web/components/models/lcc-viewer.tsx` 从“品牌化外壳”升级为“基于 Three.js + LCC Web SDK UMD 的最小真实 LCC / LCC2 加载器”。
- 新增文件：无
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `web/package.json`
  - `web/pnpm-lock.yaml`
  - `docs/lcc-web-sdk-integration.md`
- 删除文件：无
- 是否修改后端：否
- 是否修改数据库 / Prisma：否
- 是否修改 OSS / 上传架构：否
- 是否修改 deploy / 环境变量：否
- 是否新增依赖：是
- 新增依赖名称和原因：
  - `three`：用于在 `LccViewer` 内创建 `Scene`、`PerspectiveCamera`、`WebGLRenderer`，并作为 `renderLib` 传给 `window.LCC.LCCRender.load(...)`
  - `@types/three`：Next.js 生产构建阶段缺少 `three` 类型声明，导致 TypeScript 校验失败；补齐后构建通过
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - 第 1 次：失败，报错为 `Could not find a declaration file for module 'three'`
  - 修复动作：新增开发依赖 `@types/three`
  - 第 2 次：通过
  - 保留的既有 warning：
    - 多个页面仍存在 `<img>` 的 Next.js 警告
    - `components/pages/about-us.tsx` 仍有既有未使用变量警告
- 当前状态：
  - `LccViewer` 已改为真实初始化链路，使用 Three.js 创建最小渲染环境
  - 继续通过 script 动态加载 `/vendor/lcc-web/0.6.0/lcc-0.6.0.umd.js`
  - 已按要求使用 `window.LCC && window.LCC.LCCRender` 进行真实 SDK 检查
  - 已调用 `LCCRender.load(params, onLoaded, onProgress, onFailed)`，其中 `dataPath` 直接使用传入的 `viewerUrl`
  - 已在动画循环中执行 `LCCRender.update()` 与 `renderer.render(scene, camera)`
  - 已接入 `ResizeObserver + window.resize` 尺寸同步
  - 已接入最小安全清理：`cancelAnimationFrame`、移除 resize 监听、`renderer.dispose()`、清空 canvas，并优先调用 `LCCRender.unload(instance)`
  - LCC / LCC2 仍统一使用一个 `LccViewer`，内部根据 `fileFormat` 或 `.lcc2` 地址显式传入 `useLcc2`
- 风险点：
  - 当前只实现最小加载链路，尚未接轨道球控制、重置视角 API、全屏桥接、拾取、测量等交互能力
  - SDK 为单例式 `LCCRender`，当前清理策略刻意避免调用全局 `dispose()`，后续多模型频繁切换仍需关注内存与状态残留
  - 真实模型文件若依赖额外静态资源（如 wasm / worker / 其他运行时文件），仍需以运行报错为依据再补，不应提前整包复制
  - 当前默认相机与灯光参数是前端最小兜底值，复杂模型可能需要后续再调优
- 下一步建议：
  1. 在真实模型数据上联调 `viewerUrl`，确认 `.lcc` / `.lcc2` 的实际加载效果与资源依赖
  2. 评估是否需要把详情页“重置视角”按钮与 `LccViewer` 内部相机状态打通
  3. 若联调中出现运行时报错，再最小化补充 SDK 必需的静态资源，而不是复制整套 `examples/engine` 或 `assets`
  4. 视联调结果决定是否为 `LccViewer` 暴露更明确的错误态、重试入口和对外控制方法

---

## 13. 开发记录（第三步：真实模型联调前检查与日志增强）

- 修改时间：`2026-06-04 21:24:15`
- 本次目标：在不改后端的前提下，先核对 `LccViewer` 的真实模型地址来源，并为 `.lcc / .lcc2` 联调补齐更稳的格式识别、错误提示与开发态日志。
- 新增文件：无
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 删除文件：无
- 是否修改后端：否
- 是否修改数据库 / Prisma：否
- 是否修改 OSS / 上传架构：否
- 是否修改 deploy / 环境变量：否
- 是否新增依赖：否
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - 结果：通过
  - 保留的既有 warning：
    - 多个页面仍存在 `<img>` 的 Next.js 警告
    - `components/pages/about-us.tsx` 仍有既有未使用变量警告
- 当前状态：
  - 已确认 `LccViewer` 的 `viewerUrl` 直接来自模型详情页的 `detail.viewerUrl`，页面层未对地址做二次改写
  - 已确认模型详情页当前通过 `viewerType / fileFormat / viewerUrl` 识别 LCC 原生模型，且 `viewerUrl` 会原样传入 `LccViewer`
  - 已将 `LccViewer` 的格式识别从简单正则提升为“优先看 `fileFormat`，再安全解析 URL pathname 后缀”的方式，可兼容：
    - `.lcc`
    - `.lcc2`
    - `xxx.lcc?token=...`
    - `xxx.lcc2?token=...`
  - 已在开发环境增加联调日志，当前会输出：
    - `viewerUrl` 原始地址
    - SDK 脚本加载成功
    - `window.LCC` 是否存在
    - `LCCRender` 是否存在
    - `dataPath` 实际地址
    - `useLcc2` 实际值
    - `onProgress` 回调数据
    - `onLoaded` 回调数据
    - `onFailed` 回调数据
    - 初始化失败 / 渲染失败等错误日志
  - 已增强失败提示：若 SDK `onFailed` 未提供明确异常对象，页面会提示检查控制台日志和资源可访问性
  - 当前仓库内未发现可直接用于前端联调的公开 `.lcc` / `.lcc2` 测试地址，因此本轮尚未完成真实模型显示验证
- 风险点：
  - `model-detail-page.tsx` 当前的原生模型识别逻辑已能覆盖 `.lcc` / `.lcc2` 与查询参数场景，但真正能否渲染仍取决于后端返回的 `viewerUrl` 是否就是最终可访问的模型入口地址
  - 由于尚未拿到真实测试地址，当前无法确认 SDK 是否还依赖额外静态运行时资源
  - SDK 的 `onFailed` 回调可能不返回结构化错误对象，因此具体失败原因仍需结合浏览器控制台与网络面板判断
- 下一步建议：
  1. 提供一个可公开访问的 `.lcc` 地址
  2. 提供一个可公开访问的 `.lcc2` 地址
  3. 或直接提供当前线上 / OSS 返回给详情页的 `viewerUrl`
  4. 若已有失败现场，请补充浏览器控制台报错和 Network 面板失败请求截图

- 补充更新时间：`2026-06-04 21:29:55`
- 补充说明：
  - 为对齐外链联调需求，已额外输出 `viewerUrl` 原始地址与 `window.LCC` 是否存在，便于直接核对 `viewerUrl -> dataPath -> LCCRender` 初始化链路。

---

## 14. 开发记录（第四步：LCC/LCC2 ZIP 成果包处理第一版）

- 修改时间：`2026-06-04 22:10:00`
- 本次目标：实现“最小无 worker 方案”的 LCC/LCC2 ZIP 成果包处理链路：用户上传 ZIP 后，`POST /api/models` 内同步完成 ZIP 临时下载、安全解压、唯一入口识别、保持目录结构上传 OSS，并回写 `modelUrl / fileFormat / viewerType / processingStatus`。
- 新增文件：
  - `server/src/modules/models/lcc-zip.service.ts`
- 修改文件：
  - `server/package.json`
  - `server/pnpm-lock.yaml`
  - `server/src/modules/models/models.module.ts`
  - `server/src/modules/models/models.service.ts`
  - `server/src/modules/models/models.service.spec.ts`
  - `server/src/modules/uploads/object-storage.interface.ts`
  - `server/src/modules/uploads/oss.service.ts`
  - `server/src/modules/uploads/oss-compatible.service.ts`
  - `server/src/types/ali-oss.d.ts`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/dev-checkpoint.md`
- 删除文件：无
- 是否修改后端：是
- 是否修改数据库 / Prisma：否
- 是否修改 OSS / 上传架构：否（仅扩展现有服务端下载/上传能力，不改变现有 presign + callback 架构）
- 是否修改 deploy / 环境变量：否
- 是否新增依赖：是
- 新增依赖名称和原因：
  - `yauzl`：用于在 `server` 内安全读取 ZIP 条目、逐文件解压并做大小/路径校验
  - `@types/yauzl`：补齐 TypeScript 类型声明，保证 `nest build` 和 Jest 编译通过
- 构建或测试命令：
  - `cd server && pnpm build`
  - `cd server && pnpm test -- models.service.spec.ts uploads.service.spec.ts`
- 构建或测试结果：
  - `pnpm build`：通过
  - `pnpm test -- models.service.spec.ts uploads.service.spec.ts`：通过（实际匹配运行了 `models.service.spec.ts`、`uploads.service.spec.ts` 以及受 Jest 模式影响一并运行的 `admin-models.service.spec.ts`，共 25 条用例全部通过）
- 当前状态：
  - 新增 `LccZipService`，可在服务端按“下载 ZIP -> 临时落盘 -> 安全解压 -> 扫描入口 -> 批量上传处理后文件 -> 返回入口 URL”的方式处理成果包
  - ZIP 处理结果统一上传到 `processed/lcc/{modelId}/{relativePath}`
  - `POST /api/models` 在上传文件扩展名为 `.zip` 时，会进入第一版 LCC ZIP 处理分支
  - 成功时会把：
    - `modelUrl` 回写为入口文件 `publicUrl`
    - `fileFormat` 回写为 `lcc` 或 `lcc2`
    - `viewerType` 维持/回写为 `native`
    - `processingStatus` 设为 `ready`
    - `processingError` 清空
    - `processedAt` 写入当前时间
  - 失败时会把：
    - `processingStatus` 设为 `failed`
    - `processingError` 写入具体失败原因
    - `processedAt` 置空
  - 对象存储抽象已最小扩展：
    - `downloadObject(key)`
    - `putObject(key, body, contentType)`
  - OSS 与 OSS 兼容实现均已补齐，未破坏现有 build / test
- 风险点：
  - 当前缺少单独的“这是 LCC/LCC2 ZIP”显式字段，第一版先按上传文件扩展名 `.zip` 统一进入成果包处理，存在误处理普通 ZIP 的风险
  - ZIP 处理目前是 `POST /api/models` 内同步执行；若成果包较大或并发较高，会拉长发布接口耗时
  - 由于未增加数据库字段，模型记录本身不直接保存原始 ZIP 的 `modelFileId`，后续如果要做“可靠重处理/补偿重跑”，可维护性有限
  - 允许后缀目前按第一版最小白名单控制，若后续真实成果包依赖更多静态资源类型，需要依据线上报错再最小补充
- 下一步建议：
  1. 给发布弹窗补一条轻量文案，明确 `.zip` 当前用于 LCC/LCC2 成果包上传，降低误传普通 ZIP 的概率
  2. 在 Admin 后台新增“重新处理 LCC ZIP”按钮前，先评估是否需要补 `sourceFileId` 等字段，否则重处理只能依赖额外查找策略
  3. 用一份真实 LCC ZIP 和一份真实 LCC2 ZIP 做端到端联调，确认 ZIP 白名单是否还需补充后缀
  4. 若后续压缩包变大或耗时明显，再升级为队列/worker 方案，而不是继续在请求内同步处理

### 14.1 白名单补充（基于真实成果包结构复核）

- 补充时间：`2026-06-04 22:18:00`
- 本次目标：根据真实 LCC / LCC2 成果包结构，补齐 ZIP 处理器允许后缀白名单，同时保持入口识别仅允许 `.lcc` / `.lcc2`
- 修改文件：
  - `server/src/modules/models/lcc-zip.service.ts`
  - `docs/lcc-web-sdk-integration.md`
- 新增允许后缀：
  - `.lcp`
  - `.lci`
  - `.sog`
  - `.btree`
  - `.ply`
- 当前允许后缀完整集合：
  - `.lcc`
  - `.lcc2`
  - `.lcp`
  - `.lci`
  - `.bin`
  - `.sog`
  - `.btree`
  - `.ply`
  - `.json`
  - `.txt`
  - `.jpg`
  - `.jpeg`
  - `.png`
  - `.webp`
  - `.ktx2`
  - `.basis`
  - `.wasm`
- 入口识别规则不变：
  - 只允许 `.lcc` 和 `.lcc2` 作为入口文件
  - `.lcp / .lci / .bin / .sog / .btree / .ply / .json` 均不会被当作入口
- 结构处理规则不变：
  - 保持 ZIP 内完整目录结构上传到 `processed/lcc/{modelId}/{relativePath}`
  - 不允许只上传入口单文件
  - 无 `.lcc/.lcc2` 时：`processingError=未找到 LCC/LCC2 入口文件`
  - 多个 `.lcc/.lcc2` 时：`processingError=检测到多个 LCC/LCC2 入口文件，请只保留一个`

### 14.2 真实 LCC2 ZIP 端到端联调记录

- 联调时间：`2026-06-04 22:26:00`
- 本次目标：验证真实 LCC2 成果 ZIP 从“原始 ZIP 上传记录”到“ZIP 处理、OSS 回传、数据库回写”的完整链路是否可用
- 本次测试包：
  - `C:\Users\13114\Desktop\公司网站开发\公司官网首页设计\lcc2-result.zip`
  - 原始 ZIP 大小：`256,720,939 bytes`
- 联调方式：
  - 复用当前 `server/.env` 的 PostgreSQL 与对象存储配置
  - 将原始 ZIP 写入现有对象存储上传目录
  - 在 `model_files` 建立原始 ZIP 记录
  - 调用 `ModelsService.create()` 触发 LCC ZIP 处理链路
  - 回查数据库模型字段与对象存储 `processed/lcc/{modelId}/` 前缀
- 联调结果：
  - 创建模型 ID：`35`
  - 标题：`LCC2 E2E 1780582497100`
  - `processingStatus=ready`
  - `processingError=null`
  - `viewerType=native`
  - `fileFormat=lcc2`
  - `modelUrl=https://shujingspace.oss-cn-shenzhen.aliyuncs.com/processed/lcc/35/lcc2-result/蛇口医院0428.lcc2`
  - `processedAt=2026-06-04T14:16:11.604Z`
- OSS 结果：
  - 处理后前缀：`processed/lcc/35/`
  - ZIP 文件总数：`99`
  - OSS 对象总数：`99`
  - `missingCount=0`
  - `extraCount=0`
  - 说明 ZIP 内文件与 OSS 上传文件一一对应，目录结构得到完整保留
- LCC2 关键文件核对：
  - 入口文件存在：`lcc2-result/蛇口医院0428.lcc2`
  - `info/poses.json`：已上传
  - `info/report.json`：已上传
  - `info/thumb.jpg`：已上传
  - `.sog` 文件数：`39`
  - `.btree` 文件数：`28`
  - `.ply` 文件数：`28`
- 当前结论：
  - 真实 LCC2 ZIP 的后端处理链路可用
  - ZIP 安全限制、唯一入口识别、完整目录结构回传 OSS、数据库回写均按预期工作
  - 详情页前端是否“肉眼可见正常渲染”本轮未做浏览器自动化截图验证，但按当前数据库回写结果：
    - `viewerType=native`
    - `fileFormat=lcc2`
    - `modelUrl` 为 `.lcc2` 入口 URL
    已满足现有 `LccViewer` 进入条件与 `dataPath=modelUrl` 的加载前提
- 未完成项：
  - 本轮仍缺真实 LCC ZIP，因此尚未完成 `.lcc` 包的同等端到端联调

### 14.3 真实 LCC ZIP 联调前修正

- 修正时间：`2026-06-04 22:39:00`
- 背景：
  - 真实 LCC ZIP `lcc-result.zip` 中的 `data.bin` 解压后大小为 `686,933,824 bytes`
  - 第一版 ZIP 处理器的“单文件大小限制”是 `256MB`
  - 这会导致合法 LCC 成果包在解压阶段被误判为超限失败
- 本次修正：
  - 将 `server/src/modules/models/lcc-zip.service.ts` 中的单文件限制从 `256MB` 提升到 `1GB`
- 保持不变：
  - 解压总大小限制仍为 `1GB`
  - 入口识别仍只允许 `.lcc` / `.lcc2`
  - 目录深度、路径穿越、后缀白名单、文件数量限制均未放宽
- 说明：
  - 这次调整是为兼容已确认存在的真实 LCC 成果包，不是放开所有 ZIP 限制
  - 当前本地上传接口环境变量 `MAX_MODEL_SIZE_MB=500` 仍小于 `lcc-result.zip` 的原始 ZIP 体积（约 `558MB`），因此如果走完整前端上传 API，本地环境还会先卡在上传大小限制；本轮联调会单独标记这一点

### 14.4 上传大小限制补丁（仅 model zip）

- 修正时间：`2026-06-04 22:47:00`
- 背景：
  - 真实 LCC ZIP `lcc-result.zip` 原始大小约 `558MB`
  - 当前上传配置 `MAX_MODEL_SIZE_MB=500`
  - 即使 ZIP 处理器已支持该成果包，上传授权阶段仍会先拦截
- 本次修正：
  - 在 `server/src/modules/uploads/uploads.service.ts` 中，对 `kind=model` 且扩展名为 `.zip` 的文件，大小上限提升到 `max(当前模型上限, 1GB)`
  - 其他模型格式（如 `.glb/.ifc`）继续沿用原模型大小上限，不跟着放大
- 回归验证：
  - 新增测试覆盖：
    - `.zip` 模型文件可通过 `558MB` 的 presign 校验
    - 非 `.zip` 模型文件在同等体积下仍会被拒绝

### 14.5 真实 LCC ZIP 端到端联调记录

- 联调时间：`2026-06-04 22:55:00`
- 本次测试包：
  - `C:\Users\13114\Desktop\公司网站开发\公司官网首页设计\lcc-result.zip`
  - 原始 ZIP 大小：`558,509,287 bytes`
- 联调前修正：
  - 因真实成果包包含 `686,933,824 bytes` 的 `data.bin`，已先将 ZIP 处理器单文件限制提升到 `1GB`
  - 因原始 ZIP 超过本地 `500MB` 模型上限，已补上传大小策略：仅 `model zip` 允许放宽到至少 `1GB`
- 联调方式：
  - 将原始 ZIP 写入现有对象存储上传目录
  - 在 `model_files` 建立原始 ZIP 记录
  - 调用 `ModelsService.create()` 触发 ZIP 处理链路
  - 回查数据库模型字段与对象存储 `processed/lcc/{modelId}/` 前缀
- 联调结果：
  - 创建模型 ID：`36`
  - 标题：`LCC E2E 1780583219002`
  - `processingStatus=ready`
  - `processingError=null`
  - `viewerType=native`
  - `fileFormat=lcc`
  - `modelUrl=https://shujingspace.oss-cn-shenzhen.aliyuncs.com/processed/lcc/36/lcc-result/蛇口医院0428.lcc`
  - `processedAt=2026-06-04T14:30:28.770Z`
- OSS 结果：
  - 处理后前缀：`processed/lcc/36/`
  - ZIP 文件总数：`10`
  - OSS 对象总数：`10`
  - `missingCount=0`
  - `extraCount=0`
  - 说明 ZIP 内文件与 OSS 上传文件一一对应，目录结构得到完整保留
- LCC 关键文件核对：
  - 入口文件存在：`lcc-result/蛇口医院0428.lcc`
  - `attrs.lcp`：已上传
  - `collision.lci`：已上传
  - `data.bin`：已上传
  - `environment.bin`：已上传
  - `index.bin`：已上传
  - `assets/poses.json`：已上传
  - `thumb.jpg`：已上传
- 当前结论：
  - 真实 LCC ZIP 的后端处理链路可用
  - 真实 LCC2 ZIP 与真实 LCC ZIP 均已完成“原始 ZIP 上传记录 -> ZIP 解压 -> 唯一入口识别 -> 完整目录上传 OSS -> 数据库回写”的端到端联调
  - 前端详情页进入 `LccViewer` 的前提同样满足：
    - `viewerType=native`
    - `fileFormat=lcc`
    - `modelUrl` 为 `.lcc` 入口 URL

### 14.6 Viewer 分发误判修复

- 修改时间：`2026-06-04 23:08:00`
- 本次目标：修复模型详情页把其他原生模型误分发到 `LccViewer` 的问题，只允许真实 LCC / LCC2 进入 `LccViewer`
- 新增文件：
  - `web/lib/model-viewer-kind.ts`
- 修改文件：
  - `web/components/pages/model-detail-page.tsx`
  - `web/lib/types.ts`
  - `docs/lcc-web-sdk-integration.md`
- 删除文件：
  - 无
- 是否修改后端：
  - 否
- 是否修改数据库 / Prisma：
  - 否
- 是否修改 OSS / 上传架构：
  - 否
- 是否修改 deploy / 环境变量：
  - 否
- 是否新增依赖：
  - 否
- 核心修正：
  - 去掉“`viewerType === native` 直接等于 LCC Viewer”的错误判断
  - 新增统一 Viewer 分发工具，按 `viewerType + fileFormat + viewerUrl 后缀` 严格判定目标 Viewer
  - URL 后缀判断兼容 query 参数，例如 `xxx.lcc2?token=xxx`
- 当前 Viewer 分发规则：
  - `lcc`：
    - `viewerType === "lcc"`（前端兼容未来值）
    - 或 `fileFormat === "lcc" / "lcc2"`
    - 或 `viewerUrl/modelUrl` 路径后缀为 `.lcc / .lcc2`
  - `zip`：
    - `fileFormat === "zip"` 时绝不进入 `LccViewer`
  - `glb`：
    - `fileFormat === "glb" / "gltf"` 或 URL 后缀为 `.glb / .gltf`
    - 当前没有独立 GLB Viewer 时，仅显示 “GLB 模型预览区域”
  - `iframe`：
    - `viewerType === "iframe"` 时走 iframe 内嵌
    - `viewerType === "sketchfab"` 继续按外部嵌入兼容处理
    - 但若 URL 本身是 `.lcc / .lcc2`，仍优先走 `LccViewer`
  - `unsupported`：
    - 其他 `ifc / rvt / obj / fbx / osgb / ply ...` 等暂未接入的格式只显示提示，不进入 `LccViewer`
- 后端约束说明：
  - 当前 Prisma `ViewerType` 枚举仍只有 `iframe / sketchfab / native / none`
  - 在“不修改数据库 / Prisma schema”的前提下，本轮不能把新 LCC 记录直接写成 `viewerType = lcc`
  - 因此前端继续兼容旧记录：
    - `viewerType = native + fileFormat = lcc/lcc2`
    - 未来若后端新增 `viewerType = lcc`，前端也已兼容
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - `pnpm build` 通过
  - 保留既有 warning：多个 `<img>` 优化提示、`about-us.tsx` 未使用变量提示
- 当前状态：
  - LCC / LCC2 仍可进入 `LccViewer`
  - 其他 `native` 模型不再因 `viewerType = native` 被误导入 `LccViewer`
  - 基于当前数据库样本核对：
    - 模型 `35`：`native + lcc2`，仍进入 `LccViewer`
    - 模型 `36`：`native + lcc`，仍进入 `LccViewer`
    - 模型 `12`：`native + glb`，不再进入 `LccViewer`
    - 模型 `34`：`native + ifc`，不再进入 `LccViewer`
    - 模型 `19/31/32`：`iframe` 外链，继续走外部嵌入，不进入 `LccViewer`
- 风险点：
  - 当前仅修正分发逻辑，不新增 GLB / IFC 等真实在线查看器
  - 后端记录仍会继续写 `viewerType = native`，需要前端持续依赖 `fileFormat / URL 后缀` 做 LCC 精确识别
- 下一步建议：
  - 完成前端 build 后，用模型 `35 / 36` 和至少一个普通 `glb/gltf`、一个 `iframe` 外链模型做人工回归

### 14.7 统一品牌 Loading 与详情页 Viewer 收口

- 修改时间：`2026-06-04 23:24:00`
- 本次目标：
  - 继续修正模型详情页 Viewer 分发逻辑
  - 将 `LccViewer` 的技术面板式 loading 改为通用的数境空间品牌 Loading
  - 让 iframe / GLB 占位 / ZIP 未处理 / 暂不支持格式与 LCC 共用统一品牌层
- 新增文件：
  - `web/components/models/model-loading-overlay.tsx`
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `web/lib/model-viewer-kind.ts`
  - `web/lib/types.ts`
  - `docs/lcc-web-sdk-integration.md`
- 删除文件：
  - 无
- 是否修改后端：
  - 否
- 是否修改数据库 / Prisma：
  - 否
- 是否修改 OSS / 上传架构：
  - 否
- 是否修改 deploy / 环境变量：
  - 否
- 是否新增依赖：
  - 否
- 本次界面层收口：
  - 新增通用组件 `ModelLoadingOverlay`
  - 使用深色背景、轻量光晕/粒子、细进度条、小尺寸 Logo 的统一品牌 Loading
  - `LccViewer` 不再向用户暴露任何 LCC 技术面板字段
  - iframe 在 `onLoad` 前统一显示品牌 Loading，失败时显示统一失败态和重试按钮
  - GLB / GLTF、ZIP 未处理、其他未支持格式统一显示品牌风格占位信息，不进入 `LccViewer`
- 已移除的 LCC 技术元素：
  - `LCC Viewer`
  - `Web SDK 0.6.0`
  - `查看器协议`
  - `脚本状态`
  - `当前模型`
  - `在新窗口查看模型源地址`
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - `pnpm build` 通过
  - 保留既有 warning：多个 `<img>` 优化提示、`about-us.tsx` 未使用变量提示
- 当前状态：
  - 模型 `35`（`lcc2`）仍进入 `LccViewer`，但已改为统一品牌 Loading
  - 模型 `36`（`lcc`）仍进入 `LccViewer`，但已改为统一品牌 Loading
  - `glb/gltf`、`iframe`、`zip`、`ifc` 等其他格式不再误进 `LccViewer`
- 风险点：
  - 当前仍未接入真正的 GLB / GLTF 在线 Viewer，只提供统一品牌占位
  - 后端仍受 Prisma `ViewerType` 枚举限制，尚不能直接写入 `viewerType=lcc`
- 下一步建议：
  - 继续对模型 `35 / 36 / 12 / 19 / 34` 做人工打开回归，重点核对品牌 Loading 与 Viewer 分发是否符合预期

### 14.8 LccViewer 真实加载失败排查与最小修复

- 修改时间：`2026-06-05 14:50:00`
- 本次目标：
  - 暂停 UI 样式调整，只排查并修复 `LccViewer` 的真实加载失败问题
  - 开发环境补齐可追踪的调试日志，重点核对 `dataPath / useLcc2 / SDK 状态 / Three 初始化 / LCCRender.load / requestAnimationFrame`
  - 在不改后端 ZIP 处理逻辑的前提下，最小修复前端可疑点
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 是否修改后端：
  - 否
- 是否修改数据库 / Prisma：
  - 否
- 是否修改 OSS / 上传架构：
  - 否
- 是否修改 deploy / 环境变量：
  - 否
- 是否新增依赖：
  - 否
- 已确认的资源侧事实：
  - 模型 `35` 的入口 `.lcc2`：
    - `https://shujingspace.oss-cn-shenzhen.aliyuncs.com/processed/lcc/35/lcc2-result/%E8%9B%87%E5%8F%A3%E5%8C%BB%E9%99%A20428.lcc2`
    - `HEAD` 返回 `200`
    - `Content-Type=application/octet-stream`
    - `Content-Length=312428`
    - `Accept-Ranges=bytes`
  - 模型 `36` 的入口 `.lcc`：
    - `https://shujingspace.oss-cn-shenzhen.aliyuncs.com/processed/lcc/36/lcc-result/%E8%9B%87%E5%8F%A3%E5%8C%BB%E9%99%A20428.lcc`
    - `HEAD` 返回 `200`
    - `Content-Type=application/octet-stream`
    - `Content-Length=1764`
    - `Accept-Ranges=bytes`
  - 带 `Origin: http://localhost:3000` 检查时，入口文件和关键子资源均返回：
    - `Access-Control-Allow-Origin: http://localhost:3000`
    - `Access-Control-Allow-Credentials: true`
    - `Access-Control-Allow-Methods: PUT, GET, HEAD`
  - LCC 关键资源核对通过：
    - `attrs.lcp`：`200`
    - `index.bin`：`200`
    - `data.bin`：支持 `Range`，返回 `206 Partial Content`
  - LCC2 关键资源核对通过：
    - `data/3dgs/env.sog`：`200`
    - `data/mesh/0_0_0_0_0.btree`：`200`
- 本轮定位到的前端高优先级问题：
  - `LCCRender` 在 UMD SDK 内是**全局单例**：
    - `pl ||= new fl(t, n)`
    - `useLcc2`、`scene`、`camera`、`canvas`、`renderer` 会在首次创建时被绑定
  - 旧实现只调用 `unload(instance)`，**没有调用 `LCCRender.dispose()`**
  - 这会导致模型切换、重试或先后打开 `lcc2 -> lcc` 时复用旧 manager，带来：
    - `useLcc2` 状态残留
    - 旧 canvas / renderer / scene 继续被复用
    - 表现上容易出现 `0% 卡住`、重试无效或另一种格式直接失败
  - 原 `viewerUrl` 带中文文件名（如 `蛇口医院0428.lcc2` / `蛇口医院0428.lcc`），旧实现**未显式做 URL 规范化**，本轮补为编码后 `dataPath`，避免 SDK 内部路径处理受到未编码中文路径影响
- 本轮新增的开发态日志：
  - `接收到的 props`
    - `modelUrl`
    - `viewerUrl`
    - `fileFormat`
    - `viewerType`
    - `finalDataPath`
  - `格式判断`
    - `extension`
    - `isLcc`
    - `isLcc2`
    - `useLcc2`
  - `SDK 状态`
    - `sdkScriptUrl`
    - `hasWindowLCC`
    - `hasWindowLccRender`
  - `Three 初始化结果`
    - `hasCanvas`
    - `hasRenderer`
    - `canvasWidth`
    - `canvasHeight`
    - `devicePixelRatio`
  - `LCCRender.load 参数`
    - `dataPath`
    - `useLcc2`
  - `onProgress 原始回调内容`
  - `onLoaded 原始回调内容`
  - `onFailed 原始错误内容`
  - `requestAnimationFrame 已启动，LCCRender.update() 将持续执行`
- 本轮最小修复动作：
  - 新增安全函数 `getCleanPathExtension(url)`，兼容：
    - 中文路径
    - query 参数
    - hash
    - `.lcc / .lcc2 / .zip` 后缀识别
  - 新增 `normalizeDataPath(url)`：
    - 对 pathname 做 `decodeURI -> encodeURI`
    - 避免中文入口地址未编码或重复编码
  - 新增开发态 `probeDataPath(dataPath)`：
    - 调用前做 `HEAD`
    - 成功时打印 `Content-Type / Content-Length / Accept-Ranges`
    - 失败时只警告，不阻断 SDK 加载
  - 在清理阶段增加 `LCCRender.dispose()`：
    - 每次卸载 / 重试 / 切换模型时重置 SDK 全局单例
    - 避免 `useLcc2`、canvas、renderer 残留
  - 在 `model-detail-page.tsx` 最小补传：
    - `modelUrl`
    - `viewerType`
    仅用于调试输出，不改 Viewer 分发逻辑
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - 结果：通过
  - 当前保留 warning：
    - 多个页面仍存在 `<img>` 的 Next.js 警告
    - `components/pages/about-us.tsx` 仍有既有未使用变量警告
- 当前结论：
  - 目前**未发现** OSS 入口错误、子资源 `404`、`403`、CORS 缺失或 Range 不支持的问题
  - 当前已确认的前端根因是：`LCCRender` 全局单例在旧实现里未被正确 `dispose`，会导致不同模型或不同格式之间复用错误的 SDK 内部状态
  - 中文路径编码也是已修复的前端风险点；修复后可以直接在控制台对照 `before/after` 地址
- 下一步建议：
  - 本轮代码已把调试点全部补齐，请在浏览器打开模型 `35` 和 `36`，结合 Console + Network 继续确认：
    - `onProgress` 是否开始增长
    - 是否出现 `.lcc2 -> data/*.sog / *.btree / *.ply`
    - 是否出现 `.lcc -> attrs.lcp / collision.lci / data.bin / environment.bin / index.bin`
    - `onFailed` 的原始错误对象内容是什么

### 14.9 LccViewer 稳定性与相机视角适配修复

- 修改时间：`2026-06-05 15:10:00`
- 本次目标：
  - 不再调整后端、ZIP、OSS 与 Loading 样式
  - 只修复 `LccViewer` 的前端运行稳定性、React StrictMode 重复初始化影响和模型视角贴脸问题
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 是否修改后端：
  - 否
- 是否修改数据库 / Prisma：
  - 否
- 是否修改 OSS / 上传架构：
  - 否
- 是否修改 deploy / 环境变量：
  - 否
- 是否新增依赖：
  - 否（直接使用现有 `three` 包内的 `OrbitControls`）
- 本轮根因判断：
  - 浏览器日志已确认 `LCC2` 的 `HEAD -> load -> onProgress -> onLoaded` 链路成立，说明后端 ZIP、OSS 入口地址不是当前主因
  - 主要前端问题有两类：
    - `LccViewer` 普通 cleanup 中调用了 `LCCRender.dispose()`，在 React 开发模式双调用 effect 时会把全局 SDK 单例过度清空
    - `onLoaded` 已返回 `Three.Group`，但此前没有基于模型包围盒做相机自动适配，导致模型显示过近、贴脸、发糊
- 本轮生命周期修复：
  - 新增 refs 管理运行状态：
    - `hasInitializedRef`
    - `isDisposedRef`
    - `animationFrameRef`
    - `rendererRef`
    - `lccInstanceRef`
    - `currentDataPathRef`
    - 以及 `loadRequestIdRef / controlsRef / lastProgressLogRef`
  - 删除普通 cleanup 中的 `LCCRender.dispose()` 调用
  - cleanup 现在只做：
    - `cancelAnimationFrame`
    - 移除 resize 监听
    - `OrbitControls.dispose()`
    - `renderer.dispose()`
    - 清空当前挂载 DOM
  - `unload(instance)` 改为**延迟调用**：
    - 默认等待 `1200ms`
    - 用于降低 React StrictMode 立即卸载/重建时的抖动影响
  - 增加异步竞态保护：
    - 通过 `loadRequestIdRef + currentDataPathRef + isDisposedRef`
    - 旧请求的 `onLoaded / onProgress / onFailed` 不再覆盖新状态
- 本轮视角与交互修复：
  - 在 `onLoaded` 后，对返回的 `Three.Object3D` 执行：
    - `new THREE.Box3().setFromObject(...)`
    - 计算 `center / size / maxDim`
    - 自动设置 `camera.position / near / far / lookAt`
  - 新增一次性调试日志：
    - `boundingBox.min/max`
    - `center`
    - `size`
    - `maxDim`
    - `camera.position`
    - `camera.near/far`
  - 已加入最小 `OrbitControls`：
    - 支持旋转
    - 支持缩放
    - 支持平移
    - 在动画循环里执行 `controls.update()`
- 本轮日志收敛：
  - `onProgress` 不再逐次刷屏
  - 仅在 `0 / 25 / 50 / 75 / 100` 阶段输出一次
  - `onLoaded` 仍保留一次完整输出
  - `onFailed` 仍保留完整错误输出
- 对 worker ply 报错的判断：
  - 当前日志中虽然存在：
    - `Failed to load worker ply (#2 / #3 ...)`
  - 但同一轮日志里已经出现：
    - `onProgress -> 1`
    - `onLoaded -> Group`
  - 因此当前先标记为：
    - **可能的非阻塞 worker 报错**
  - 在未证明它阻止整体显示前，本轮不继续改 SDK、不改后端 ZIP、不改 OSS 结构
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - 结果：通过
  - 保留既有 warning：
    - 多个页面仍存在 `<img>` 的 Next.js 警告
    - `components/pages/about-us.tsx` 仍有既有未使用变量警告
- 当前状态：
  - 已从组件实现上去掉普通 cleanup 的全局单例销毁
  - 已从组件实现上加入实例级 `unload(instance)`、相机自动适配和基础交互控制
  - 是否“肉眼已可正常查看”仍需浏览器打开模型 `35 / 36` 做最终人工确认

### 14.10 LCC2 专项排查与最小参数收敛

- 修改时间：`2026-06-05 15:45:00`
- 本轮范围：
  - 只排查 `.lcc2` 加载失败
  - 不改后端、ZIP、OSS、数据库、Loading UI
  - 不动已正常的 `.lcc` 浏览逻辑
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 证据结论：
  - `.lcc2` 入口地址可访问：
    - `processed/lcc/35/lcc2-result/蛇口医院0428.lcc2`
    - `HTTP 200`
    - `Content-Type: application/octet-stream`
    - `Access-Control-Allow-Origin: http://localhost:3000`
    - `Accept-Ranges: bytes`
  - LCC2 关键资源可访问：
    - `data/3dgs/env.sog` -> `200`
    - `data/mesh/0_0_0_0_0.btree` -> `200`
    - `data/mesh/0_0_0_0_0.ply` -> `200`
    - `info/poses.json` / `info/report.json` -> 可正常访问
  - `.ply` 资源支持 Range：
    - `Range: bytes=0-63` 返回 `206 Partial Content`
  - 因此当前未发现：
    - `404`
    - `403`
    - 基础 CORS 拒绝
    - OSS 不支持 Range
- 对 worker ply 的判断：
  - 旧日志中出现过：
    - `Failed to load worker ply (#2 of 3)`
    - `Failed to load worker ply (#3 of 3)`
  - SDK UMD 代码确认其内部确实使用 Worker 池，且默认并发较高：
    - `MaxConcurrentDownloads = 5`
    - `WorkerPerFrameRequests = 5`
    - 另有 Worker pool 默认 `maxConcurrency = 3`
  - 结合错误命名里的 `(#2 of 3)` / `(#3 of 3)`，当前更像是：
    - **LCC2 的 worker 并发路线在当前浏览器 / Next dev 环境下不稳定**
    - 而不是 `.ply / .sog / .btree` 资源本身访问失败
- 是否发现中文路径问题：
  - 当前未发现明确证据证明中文文件名导致 `.lcc2` 入口或相对资源路径失效
  - 入口 URL 使用 `encodeURI` 后可正常访问，且资源目录结构与入口同级相对路径保持一致
  - 本轮未改后端路径结构
- 本轮最小修复：
  - 仅在 `useLcc2 === true` 时，为 `LCCRender.load(...)` 增加保守参数：
    - `maxConcurrentDownloads: 1`
    - `workerPerFrameRequests: 1`
    - `enableLoadingLog: true`（仅开发环境）
  - `.lcc` 分支不受影响，继续沿用原参数
- 这样做的原因：
  - 先降低 LCC2 worker / 下载并发，减少 blob worker 多线程初始化失败概率
  - 同时保留 SDK 开发态日志，便于继续观察 LCC2 是否从“worker 阶段失败”转为“onLoaded 后显示阶段”
- 本轮构建验证：
  - 命令：`cd web && pnpm build`
  - 结果：通过
  - 仅保留项目既有 warning，无新增错误
- 当前残余不确定性：
  - 由于本轮未直接拿到浏览器最新 Console / Network 导出，`onFailed` 的最新原始错误对象仍待人工复测确认
  - 如果降低并发后仍失败，下一步应重点看：
    - 浏览器 Console 中 `[LccViewer] onFailed 原始错误内容`
    - 是否仍出现 `Failed to load worker ply`
    - 新增的 SDK loading log 是否暴露更具体的 worker 初始化细节

### 14.11 LCC / LCC2 联合回归修复

- 修改时间：`2026-06-05 16:05:00`
- 本轮问题：
  - 在上一轮只针对 `.lcc2` 收敛参数后，出现了：
    - `LCC2` 可以打开
    - 但切回 `.lcc` 后失败
  - 这说明问题已经不是单一格式资源问题，而是：
    - **`LccViewer` 公共加载链路里的格式分支或 SDK 单例生命周期被污染**
- 本轮根因判断：
  - 最近最可疑的公共变更有两类：
    - `LCC2` 专属参数收敛
    - cleanup 中的 instance 延迟卸载策略
  - 当前更可能的回归根因是：
    - 旧的 `.lcc2` renderer instance 在 cleanup 后没有在**新 `.lcc` 加载前**被立即卸载
    - LCC Web SDK 是单例管理器，导致 `.lcc2 -> .lcc` 切换时旧状态继续污染新 load
  - 因此，本轮修复重点不在后端，也不在 OSS，而在：
    - **同一个 `LccViewer` 内部的 load 参数分支清晰化**
    - **新 dataPath 加载前的 previous instance 安全卸载**
- 本轮代码调整：
  - 将 load 参数构建明确抽为：
    - `buildLccLoadParams({ baseParams, useLcc2 })`
  - 规则变为：
    - LCC:
      - `useLcc2 = false`
      - 不传 `maxConcurrentDownloads`
      - 不传 `workerPerFrameRequests`
      - 不传 `enableLoadingLog`
    - LCC2:
      - `useLcc2 = true`
      - `maxConcurrentDownloads = 1`
      - `workerPerFrameRequests = 1`
      - `enableLoadingLog = true`（仅开发环境）
  - 新增格式相关日志：
    - `dataPath`
    - `extension`
    - `currentFormat`
    - `useLcc2`
    - 最终格式相关 load 参数
    - 是否执行了 `unload previous instance`
  - 调整 SDK 单例生命周期：
    - 仍然**不恢复**普通 cleanup 中的全局 `dispose()`
    - 但在**每次新 load 之前**，若存在旧 instance，则立即执行：
      - `LCCRender.unload(previousInstance)`
    - 后续已进一步收口为同步 `unload(instance)`，不再保留延迟 unload
    - 这样既避免回到全局 `dispose()` 方案，也避免旧 `.lcc2` instance 污染新 `.lcc` load
- 关键实现结果：
  - LCC / LCC2 继续共用一个 `LccViewer`
  - 仅允许参数按格式分支
  - `.lcc` 与 `.lcc2` 的 load 参数边界已拆清
  - previous instance 在新加载前会被安全卸载
- 本轮修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 本轮构建验证：
  - 命令：`cd web && pnpm build`
  - 结果：通过
  - 仅保留项目既有 warning，无新增错误
- 当前仍需人工浏览器复测的顺序：
  - 先打开模型 `36`，确认 `.lcc` 恢复
  - 再打开模型 `35`，确认 `.lcc2` 未回归
  - 再回到模型 `36`，确认切换顺序不再影响结果

### 14.12 历史问题（已废弃）：曾错误尝试把入口文件 URL 改成成果包目录 URL

- 修改时间：`2026-06-05 16:25:00`
- 状态：**已废弃，不再采用**
- 废弃说明：
  - 该阶段曾错误认为 SDK 期望目录 `dataPath`
  - 现已被 14.13 的 SDK 源码核对结果推翻
  - 仅作为历史排错记录保留，不能再作为实现依据
- 最新根因确认：
  - 浏览器日志显示，SDK 曾错误请求：
    - `.../lcc-result/蛇口医院0428.lcc/meta.lcc2`
  - 这说明此前传给 `LCCRender.load(...)` 的 `dataPath` 是：
    - `.lcc / .lcc2` 入口文件 URL
  - 但 SDK 实际期望的 `dataPath` 语义是：
    - **LCC / LCC2 成果包目录 URL**
- 正确语义示例：
  - `entryUrl`
    - `https://.../processed/lcc/36/lcc-result/蛇口医院0428.lcc`
  - `sdkDataPath`
    - `https://.../processed/lcc/36/lcc-result/`
  - `entryUrl`
    - `https://.../processed/lcc/35/lcc2-result/蛇口医院0428.lcc2`
  - `sdkDataPath`
    - `https://.../processed/lcc/35/lcc2-result/`
- 本轮代码调整：
  - 新增 / 改造两个 URL 语义函数：
    - `normalizeEntryUrl(...)`
    - `getLccSdkDataPath(...)`
  - 规则：
    - 若 URL 后缀为 `.lcc / .lcc2`
      - 去掉最后一个文件名
      - 返回目录 URL
      - 确保以 `/` 结尾
    - 若 URL 本身已是目录
      - 确保以 `/` 结尾
    - `sdkDataPath` 默认不携带 query / hash，避免 SDK 拼接子资源路径时混乱
    - 继续保留 `entryUrl` 作为：
      - 格式判断依据
      - 开发日志输出
      - 入口资源可访问性 HEAD 检查对象
  - `LCCRender.load(...)` 现改为：
    - `dataPath = sdkDataPath`
    - 不再传 `.lcc / .lcc2` 入口文件 URL
- 本轮开发日志补充：
  - 加载前输出：
    - `entryUrl`
    - `sdkDataPath`
    - `fileFormat`
    - `useLcc2`
    - 最终格式相关 load 参数
- 本轮影响范围：
  - 仅修改：
    - `web/components/models/lcc-viewer.tsx`
    - `docs/lcc-web-sdk-integration.md`
  - 未修改：
    - `server`
    - 数据库 / Prisma
    - OSS 路径
    - ZIP 解压逻辑
    - Loading UI
- 本轮构建验证：
  - 命令：`cd web && pnpm build`
  - 结果：通过
  - 仅保留项目既有 warning，无新增错误
- 历史结论：
  - 该方案后来被确认是错误方向，不能继续使用
  - 当前最终方案见：
    - `14.13 SDK 官方 dataPath 规范复核：回退到入口文件 URL`
    - `14.14 最终方案收口：统一采用入口文件 URL 模式`

### 14.13 SDK 官方 dataPath 规范复核：回退到入口文件 URL

- 修改时间：`2026-06-05 16:45:00`
- 本轮重新核对文件：
  - `LCC-Web-0.6.0/examples/three.html`
  - `LCC-Web-0.6.0/README_zh.md`
  - `LCC-Web-0.6.0/sdk/lcc-0.6.0.js`
  - `LCC-Web-0.6.0/sdk/lcc-0.6.0.umd.js`
- 官方规范结论：
  - `three.html` 示例明确传入：
    - `dataPath: ${location.origin}/assets/ConfuciusTemple/meta.lcc`
  - 也即 **官方示例优先使用入口文件 URL**，不是目录 URL。
- 源码关键结论：
  - LCC 分支：
    - `#Me(t)` 会把 `.../xxx.lcc` 或 `.../xxx.splat` 解析成：
      - `rootPath`
      - `metaName`
    - 如果 `dataPath` 已带文件名，例如 `蛇口医院0428.lcc`
      - SDK 将请求：
        - `.../蛇口医院0428.lcc`
        - 或 `.../蛇口医院0428.splat`
    - 如果只传目录 URL
      - SDK 才会 fallback 到：
        - `.../meta.lcc`
        - `.../meta.splat`
  - LCC2 分支：
    - `#Tc(t)` 会判断路径是否以 `.lcc2` 结尾
    - 如果 `dataPath` 是 `.../xxx.lcc2`
      - SDK 使用该显式入口文件
    - 如果只传目录 URL
      - SDK fallback 到：
        - `.../meta.lcc2`
  - `fl.#pm(t)` 的自动格式判断也直接依赖：
    - `dataPath.pathname.endsWith(".lcc2")`
- 本轮对之前判断的纠正：
  - 14.12 中“SDK 实际期望目录 URL”的判断被源码证据推翻。
  - 日志里出现：
    - `processed/lcc/36/lcc-result/meta.lcc`
    - `processed/lcc/36/lcc-result/meta.splat`
    - `processed/lcc/35/lcc2-result/meta.lcc2`
  - 并不是 ZIP 发布结构先天错误，而是因为前端把 `dataPath` 改成了目录 URL，触发了 SDK 的默认固定文件名 fallback。
- 本轮前端修正：
  - `LccViewer` 重新统一为：
    - `dataPath = entryUrl`
  - `entryUrl` 保持数据库里的真实入口文件 URL：
    - `.../蛇口医院0428.lcc`
    - `.../蛇口医院0428.lcc2`
  - 不再把目录 URL 传给 `LCCRender.load(...)`
- 本轮后端结论：
  - **暂不修改** `server/src/modules/models/lcc-zip.service.ts`
  - **暂不标准化复制** `meta.lcc / meta.lcc2 / meta.splat`
  - 原因：
    - 当前 ZIP 处理后已经保留了真实入口文件
    - SDK 官方支持“显式入口文件 URL”模式
    - 继续改后端标准名会放大变更范围，但现阶段没有必要
- 本轮实际修改：
  - 修改：
    - `web/components/models/lcc-viewer.tsx`
    - `docs/lcc-web-sdk-integration.md`
  - 未修改：
    - `server`
    - 数据库 / Prisma
    - OSS 架构
    - ZIP 解压逻辑
    - Loading UI
- 本轮构建验证：
  - 命令：`cd web && pnpm build`
  - 结果：通过
  - 仅保留项目既有 warning，无新增错误

### 14.14 最终方案收口：统一采用入口文件 URL 模式

- 修改时间：`2026-06-05 17:10:00`
- 本轮目标：
  - 根据 SDK 官方示例、SDK 源码和 OSS 实测结果，正式收口 `LccViewer` 的 `dataPath` 规则
  - 不再允许目录 URL 进入 `LCCRender.load(...)`
  - 保持 `LCC / LCC2` 共用同一个 `LccViewer`
- 修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 是否修改后端：
  - 否
- 是否修改数据库 / Prisma：
  - 否
- 是否修改 OSS / ZIP 解压 / 上传架构：
  - 否
- 是否修改 deploy / 环境变量：
  - 否
- 最终 `dataPath` 规则：
  - `LCC`：`dataPath` 必须是 `.lcc` 入口文件 URL
  - `LCC2`：`dataPath` 必须是 `.lcc2` 入口文件 URL
  - 不再把：
    - `https://.../lcc-result/`
    - `https://.../lcc2-result/`
    这类目录 URL 传给 SDK
- 不采用的方案：
  - 不再依赖目录模式
  - 不再依赖 `meta.lcc`
  - 不再依赖 `meta.lcc2`
  - 不再依赖 `meta.splat`
  - 后端无需额外生成 `meta.*` 别名文件
- 采用该方案的依据：
  - 官方示例 `examples/three.html` 直接传 `meta.lcc` 文件 URL，而不是目录 URL
  - SDK 源码支持通过 `dataPath` 直接指定自定义入口文件名
  - 当前 OSS 实测：
    - `蛇口医院0428.lcc` -> `200`
    - `蛇口医院0428.lcc2` -> `200`
    - `meta.lcc` / `meta.lcc2` / `meta.splat` -> `404`
  - 结论：目录模式与当前发布结构不匹配
- 本轮前端收口动作：
  - 删除目录 `dataPath` 的使用路径，`LccViewer` 不再做“入口 URL -> 目录 URL”转换
  - 若进入 `LccViewer` 的 URL 不是 `.lcc / .lcc2` 入口文件 URL，直接阻止加载并给出错误提示
  - 格式判断优先级保持为：
    1. `fileFormat`
    2. `modelUrl / viewerUrl` 后缀
    3. 不再依赖目录名
  - `LCC2` 保守参数只在 `useLcc2=true` 时生效：
    - `maxConcurrentDownloads: 1`
    - `workerPerFrameRequests: 1`
    - `enableLoadingLog: true`（仅开发环境）
  - `LCC` 分支不携带上述 `LCC2` 专属参数
- 本轮开发日志收口：
  - 加载前统一输出一次：
    - `entryUrl`
    - `dataPath`
    - `fileFormat`
    - `useLcc2`
    - `isEntryFileUrl`
  - 不再输出 `sdkDataPath`、目录路径等容易误导的概念
- 回归验证记录：
  - SDK 官方验证：已完成

### 14.15 自检与残留代码清理

- 修改时间：`2026-06-05 17:35:00`
- 本轮范围：
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/models/model-loading-overlay.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `web/lib/model-viewer-kind.ts`
  - `docs/lcc-web-sdk-integration.md`
- 运行代码清理结果：
  - 已确认运行代码中**不再存在**：
    - `sdkDataPath`
    - `getLccSdkDataPath`
    - 入口 URL 转目录 URL 的逻辑
    - 目录模式 `dataPath`
  - `LccViewer` 继续只接受 `.lcc / .lcc2` 入口文件 URL
  - 将误导性的运行态命名收口为：
    - `currentEntryUrlRef`
    - `activeInstanceEntryUrlRef`
  - 删除未被 UI 使用的本地错误状态写入，避免形成“界面会展示技术错误详情”的误导
- 生命周期保护保留结果：
  - 保留同步 `unload(instance)`
  - 保留格式切换前受控 `dispose()`
  - 保留全局 `loadId / activeGlobalLoadId` owner 防护
  - 保留旧回调防污染判断
  - 不恢复普通 cleanup 中的全局 `dispose()`
- 日志收敛结果：
  - 保留：
    - `LCCRender.load 前参数`
    - `useLcc2`
    - `format`
    - `dataPath`
    - `didUnloadPreviousInstance`
    - `didDisposeForFormatSwitch`
    - `onLoaded`
    - `onFailed`
  - 删除 / 不再保留：
    - `sdkDataPath` 等目录模式日志
    - 误导性的目录 `dataPath` 术语
  - `onProgress` 仍按阶段阈值输出，不做逐帧刷屏
- Viewer 分发与 Loading 自检：
  - `model-detail-page.tsx` 继续仅在 `viewerKind === "lcc"` 时进入 `LccViewer`
  - `viewerType = native` 不会直接等于 `LccViewer`
  - `model-loading-overlay.tsx` 未发现 `LCC Viewer / SDK 状态面板 / dataPath / useLcc2` 等技术界面残留
- 文档整理结果：
  - 保留历史错误尝试，但已明确：
    - 14.12 为**已废弃历史方案**
  - 当前最终结论仍以：
    - 14.13
    - 14.14
    为准
- 本轮是否修改后端 / 数据库 / OSS / ZIP：
  - 否
- 本轮构建验证：
  - 命令：`cd web && pnpm build`
  - 结果：通过
  - 仅保留项目既有 warning，无新增错误
  - OSS 入口文件验证：已完成
  - 本轮前端代码验证：已完成
  - 本轮浏览器自动化回归：已完成（Playwright / `http://localhost:3000` 同源上下文）
  - `LCC` 回归结果：
    - 最终状态：`loaded=true`
    - 未再请求：
      - `lcc-result/meta.lcc`
      - `lcc-result/meta.splat`
    - 已直接请求：
      - `蛇口医院0428.lcc`
      - `collision.lci`
      - `data.bin`
      - `environment.bin`
      - `index.bin`
  - `LCC2` 回归结果：
    - 最终状态：`loaded=true`
    - 未再请求：
      - `lcc2-result/meta.lcc`
      - `lcc2-result/meta.splat`
      - `lcc2-result/meta.lcc2`
    - 已直接请求：
      - `蛇口医院0428.lcc2`
      - `data/*.sog`
      - `data/*.btree`
      - `data/*.ply`
  - 本轮未观察到新的 `meta.lcc / meta.lcc2 / meta.splat` 404
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - `pnpm build`：通过
  - 自动化回归：通过（`LCC` / `LCC2` 最终均到达 `loaded=true`）
- 当前风险点：
  - 若后续后端错误回写目录 URL，而不是 `.lcc / .lcc2` 入口文件 URL，当前 `LccViewer` 会直接阻止加载，这是有意的防误配保护
  - 浏览器端最终 Network 回归仍需以模型 `35 / 36` 实机打开结果为准
- 下一步建议：
  - 先用模型 `36` 验证 `.lcc` 不再请求 `meta.lcc / meta.splat`
  - 再用模型 `35` 验证 `.lcc2` 不再请求 `meta.lcc / meta.splat / meta.lcc2`
  - 若两者都通过，则后续不要再回到目录模式

### 14.15 生命周期修复：处理 SDK 单例污染与 StrictMode 双执行

- 修改时间：`2026-06-05`
- 本轮目标：
  - 保持 `dataPath` 继续使用入口文件 URL 模式
  - 不改后端、不生成 `meta.*`
  - 只修复 `web/components/models/lcc-viewer.tsx` 的生命周期与 SDK 单例清理
- 本轮根因判断：
  - 最新日志已经证明 `LCC` 分支传入的是 `.lcc` 入口文件 URL，`HEAD 200`、`fileFormat=lcc`、`useLcc2=false`
  - 但切换场景下 SDK 仍可能去请求 `.lcc/meta.*`，说明问题不在 `dataPath`，而在 **LCCRender 全局单例状态被前一次 load 污染**
  - 具体污染来源有三类：
    - 延迟 `unload(previous instance)` 会把旧实例清理拖到下一次加载之后
    - `LCC2 -> LCC` 格式切换前没有做受控 `dispose()`，旧格式内部状态仍可能残留
    - React StrictMode 开发模式会触发组件重挂载，旧实例 cleanup 若继续触碰全局 SDK，会干扰新实例 load
- 本轮前端修复动作：
  - 取消延迟 unload：
    - 删除 `setTimeout` 延迟卸载策略
    - 新 load 前先同步执行 `LCCRender.unload(instance)`
    - 普通 cleanup 中也改为同步安全 unload，不再延迟
  - 增加格式切换前 SDK reset：
    - 增加 `previousFormatRef`
    - 增加模块级 `lastSdkFormat`
    - 仅在 `LCC <-> LCC2` 切换前执行一次 `LCCRender.dispose()`
    - 普通 cleanup 中仍然**禁止随意 dispose**
  - 增加 StrictMode 防护：
    - 增加跨组件实例的全局 load owner
    - 旧实例 cleanup 仅清理本地 Three 资源，不再越权清理当前活跃的全局 SDK load
    - `onProgress / onLoaded / onFailed` 统一走 loadId stale check，旧回调直接忽略
  - 保持 load 参数规则不变：
    - `LCC`: `dataPath=.lcc`、`useLcc2=false`、不带 `LCC2` 专属参数
    - `LCC2`: `dataPath=.lcc2`、`useLcc2=true`、保留保守参数
- 本轮开发日志新增关注项：
  - `previousFormat`
  - `currentFormat`
  - `didUnloadPreviousInstance`
  - `didDisposeForFormatSwitch`
  - `hasLcc2SpecificParams`
- 回归验证记录（Playwright / `http://localhost:3000` 同源上下文）：
  - 直接打开 `LCC` 模型 `36`：
    - 结果：`loaded=true`
    - 未出现：
      - `.lcc/meta.lcc2`
      - `meta.lcc`
      - `meta.lcc2`
      - `meta.splat`
  - 直接打开 `LCC2` 模型 `35`：
    - 结果：`loaded=true`
    - 未出现：
      - `.lcc/meta.lcc2`
      - `meta.lcc`
      - `meta.lcc2`
      - `meta.splat`
  - `LCC2(35) -> LCC(36)` 切换：
    - 结果：`loaded=true`
    - `didDisposeForFormatSwitch=true`
    - 未出现：
      - `.lcc/meta.lcc2`
      - `meta.lcc`
      - `meta.lcc2`
      - `meta.splat`
  - `LCC(36) -> LCC2(35)` 切换：
    - 结果：已在自动化切换中达到 `loaded=true`
    - `didDisposeForFormatSwitch=true`
    - 未出现：
      - `.lcc/meta.lcc2`
      - `meta.lcc`
      - `meta.lcc2`
      - `meta.splat`
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - `pnpm build`：通过
  - 保留项目既有 warning：
    - 多处 `<img>` 的 Next.js 警告
    - `components/pages/about-us.tsx` 的既有未使用变量警告
- 当前结论：
  - 本轮确认根因属于 **SDK 单例生命周期污染**，而不是 `dataPath` 规则错误
  - 入口文件 URL 模式继续保持，不需要回退到目录模式
  - 后端仍无需生成 `meta.lcc / meta.lcc2 / meta.splat`

### 14.16 统一模型 Loading 黑白像素风重做

- 修改时间：`2026-06-05 18:10:00`
- 本轮范围：
  - `web/components/models/model-loading-overlay.tsx`
  - `docs/lcc-web-sdk-integration.md`
- 设计目标：
  - 将现有偏蓝色科技卡片式 Loading 重做为统一的黑底极简像素风
  - 视觉基准参考 `web/public/loading/loading-style-reference.png`
  - 品牌主视觉基于 `web/public/loading/loading-logo-reference.png`
  - 本组件继续作为所有模型格式共用的统一 Loading，不做 `LCC / LCC2 / GLB / IFC / OSGB` 视觉分叉
- 本轮前端实现：
  - 主视觉改为黑白像素风 `DIGIREALM SPACE` logo 居中布局
  - 去除原有 `LCC Viewer / SDK / dataPath / useLcc2` 等技术感界面表达
  - 进度区改为白色像素边框长条，保留真实 `progress` 数值显示
  - 进度条上方增加 8-bit 跑动小人，并根据进度位置移动
  - 当调用方没有传入真实 `progress` 时，组件内部使用缓慢推进的假进度，保证 `iframe` 等场景仍具备统一加载动效
  - 错误态继续复用同一套视觉，仅保留文案差异与重试按钮
- 本轮是否修改：
  - 后端：否
  - 数据库 / Prisma：否
  - OSS / ZIP：否
  - deploy：否
  - `LccViewer` 核心加载逻辑：否
  - `LCC / LCC2 dataPath` 规则：否
- 统一性说明：
  - 当前统一 Loading 仍由 `model-loading-overlay.tsx` 单点维护
  - `lcc-viewer.tsx`、`iframe-viewer.tsx` 继续只负责传入状态、进度和重试行为，不承载独立 Loading 视觉

### 14.17 LCC / LCC2 默认视角、方向与 resetView 修复

- 修改时间：`2026-06-05`
- 本轮目标：
  - 只修复 `LCC / LCC2` 打开后的默认视角、方向继承、视图范围和 `resetView`
  - 不改 `dataPath` 规则，不改后端、ZIP、OSS、Loading、工具栏 UI
- 主要修改文件：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/model-viewer-architecture.md`
- 官方 SDK / 示例复核结论：
  - `examples/three.html` 的相机初始化不是 `Box3 fit`，而是固定：
    - `camera.position.set(0, 2, 0)`
    - `lookAt(0, 2, 1)`
  - 官方示例显式传入 `modelMatrix`：
    - `[-1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1]`
  - 官方示例注释明确说明：
    - 优先使用 `modelMatrix` 修正坐标系
    - `camera.up.set(0, 0, 1)` 只是可选说明，示例本身没有启用
  - 官方公开 `LCCRender` API 中能确认的仅有：
    - `load`
    - `setCamera`
    - `update`
    - `unload`
    - `dispose`
    - `raycast`
    - `raycastFromOrigin`
    - `clearIndexDB`
    - `getVersion`
  - SDK 返回的 renderer instance 额外可见：
    - `getMeta()`
    - `getBounds()`
  - 本轮未在 SDK 示例和源码中发现公开的：
    - `resetCamera`
    - `fitView`
    - `getCamera`
    - `getPose`
    - `getDefaultPose`
    - `applyPose`
    - `setView`
- poses / report 结论：
  - SDK 源码中未发现自动读取 `poses.json` / `report.json` 的公开逻辑和 API
  - 当前 OSS 实际文件存在：
    - `LCC`：`assets/poses.json`、`report.json`
    - `LCC2`：`info/poses.json`、`info/report.json`
  - 当前模型 `35 / 36` 的 `poses.json` 内容是采集轨迹数组：
    - 字段主要为 `poses[].T / poses[].R / ts`
    - 未发现 `defaultPose / defaultView / target / up / matrix / lookAt` 这类可直接作为“打开默认视角”的显式字段
  - 因此本轮策略为：
    - 先尝试解析 SDK 可用信息
    - 再尝试读取 `poses.json` 中是否存在显式默认视角字段
    - 若没有，再退回 bounds fit
- 本轮前端修复：
  - `LccViewer` 初始化对齐官方示例：
    - 相机初始位置改为 `0,2,0`
    - 初始朝向改为 `lookAt(0,2,1)`
    - 加载参数补回官方 `modelMatrix`
  - `onLoaded` 后按顺序恢复默认视角：
    1. 预留 SDK 官方默认 pose / 相机 API（当前未发现可用公开接口）
    2. 读取 `poses.json` 中是否存在显式默认视角字段（当前模型未命中）
    3. 使用 bounds 计算默认视角
  - bounds 优先级：
    - 优先 `renderer instance.getBounds()`
    - 拿不到再用 `Three.Box3().setFromObject(...)`
  - 计算 bounds 前会先执行：
    - `group.updateWorldMatrix(true, true)`
    - `scene.updateMatrixWorld(true)`
  - 新的 bounds fit 不再使用随意的斜向量 `(1, 0.45, 1)`
  - 新的 bounds fit 会保持官方示例的前向方向，并按当前 `fov` 计算距离、`near / far`
  - `resetView` 不再 remount：
    - 改为回放首次解析出的默认相机快照
    - 快照来源可能为 `sdk / poses / bounds`
- 当前默认视角来源优先级：
  1. SDK 官方相机 / pose API（若未来版本暴露）
  2. `poses.json` 显式默认视角
  3. bounds fit fallback（优先 SDK `getBounds()`，否则 Three `Box3`）
- 本轮根因判断：
  - 旧实现没有对齐官方 `modelMatrix`
  - 旧实现用任意方向 `Box3 fit`，把相机放到了“背面/斜后方”
  - 旧实现没有把 `resetView` 绑定到真实默认视角，只是退回 fit/remount
  - 因此出现：
    - 打开方向反
    - 视图范围不对
    - `fit` 后不是用户预期的官方打开视角
- 本轮日志收口：
  - 仅开发环境输出一次“默认视角解析结果”
  - 输出内容包括：
    - `format`
    - `useLcc2`
    - 是否读到 official pose
    - `poses.json` / `report.json` 路径
    - 是否使用 SDK pose API
    - 是否使用 `poses.json`
    - 是否 fallback 到 Box3
    - bounds 信息
    - 当前 camera `position / target / up`
    - `resetView` 的实际来源
- 本轮保持不变：
  - `dataPath` 继续使用 `.lcc / .lcc2` 入口文件 URL
  - 不回退到目录 `dataPath`
  - 不生成 `meta.lcc / meta.lcc2 / meta.splat`
  - 不改后端、数据库、OSS、ZIP、Loading 和工具栏 UI

### 14.18 poses.json 轨迹默认视角方案回退说明

- 修改时间：`2026-06-05`
- 回退原因：
  - 人工验收确认 `bestTrajectoryPose` 虽然能选中轨迹点，但实际打开视角仍然歪
  - `poses.json` 中的轨迹更像采集轨迹，不等于模型成果包保存的出生点 / 默认视角
- 当前默认视角优先级恢复为：
  1. `poses.json` 中显式默认相机字段，例如 `defaultView / defaultPose / camera`
  2. `sdkBounds` 默认快照
  3. Three `Box3` fallback
- 当前默认策略明确不再使用：
  - 第一条轨迹点
  - `bestTrajectoryPose`
  - `poses` 轨迹筛选结果
- 轨迹筛选代码处理方式：
  - 保留为实验性诊断代码
  - 默认 `enabled = false`
  - 不参与默认视角选择
  - 不影响 `resetView`
- `resetView` 行为：
  - 优先回到显式默认相机
  - 否则回到 `sdkBounds`
  - 最后回到 Three `bounds` fallback
- 开发日志（仅开发环境单次输出）：
  - 最终 `posesSource` 不再输出 `bestTrajectoryPose`
  - 可保留 `trajectoryCandidate.enabled = false` 作为诊断信息
  - `resetViewSource` 应为 `defaultCamera / sdkBounds / bounds`

### 14.19 LCC / LCC2 默认视角原则

- 修改时间：`2026-06-05`
- 默认视角只在 `LccViewer` 内处理，不向其他格式 Viewer 外溢
- 当前默认视角优先级：
  1. 平台未来保存的 `defaultCameraJson`
  2. 成果包中明确保存的出生点字段，例如：
     - `defaultView / defaultPose`
     - `initialView / startView`
     - `birthView / homeView`
     - `camera`
     - `position + target + up`
     - `eye + center + up`
     - `cameraMatrix / viewMatrix`
  3. SDK 官方默认视角 / `sdkBounds`
  4. Three `bounds` fallback
- `LccViewer` 已预留 `defaultCameraJson` 兼容：
  - 当前前端链路尚未实际传入该字段
  - 若未来模型详情接口补充 `model.defaultCameraJson`，组件可直接解析并优先使用
- 明确禁止：
  - 不使用 `firstTrajectory`
  - 不使用 `bestTrajectoryPose`
  - 不使用 `poses` 第 N 帧自动猜默认打开视角
  - 不把 `poses / T / R / ts` 轨迹逻辑作为出生点视角
- 结论：
  - `poses` 更接近采集轨迹，不等于成果包默认出生点
  - `resetView` 只回到最终确认的默认视角来源，不回到轨迹猜测结果

### 14.20 LCC spawnPoint 接入与 LCC2 runtime 反查

- 修改时间：`2026-06-06`
- 本轮范围：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/model-viewer-architecture.md`
- 是否修改后端 / 数据库 / Prisma / OSS / ZIP / dataPath：
  - 否
- LCC 默认视角最新优先级：
  1. `defaultCameraJson`
  2. `attrs.lcp.spawnPoint`
  3. 成果包显式默认相机字段：`defaultView / defaultPose / camera / matrix`
  4. `sdkBounds`
  5. Three `bounds`
- LCC 接入方式：
  - 仅在 `fileFormat = lcc` 时，根据 `.lcc` 入口 URL 推导同目录 `attrs.lcp`
  - 前端直接 `fetch(attrs.lcp)`，按 JSON 解析：
    - `spawnPoint.position`
    - `spawnPoint.rotation`
  - 若字段有效，则生成默认相机快照并写入 `defaultViewRef`
  - `resetView` 会回到该快照
  - 若 `attrs.lcp` 缺失、解析失败或字段无效，则继续回退到 `sdkBounds / bounds`
- `spawnPoint.rotation` 处理策略：
  - 当前不硬编码单一四元数顺序
  - 会同时尝试：
    - `wxyz`
    - `xyzw`
  - 并结合当前 bounds 校验朝向是否面向模型
  - 若旋转无法稳定得到合理朝向，则保守回退为：
    - 使用 `spawnPoint.position`
    - `lookAt(bounds center)`
  - 开发环境会输出：
    - 原始 `position / rotation`
    - 选中的 `quaternionOrder`
    - 解析后的 `forward / up / target`
    - 是否实际使用 rotation
    - fallback 原因
- 当前已知限制：
  - `attrs.lcp.spawnPoint` 目前只明确提供：
    - `position`
    - `rotation`
  - 未见显式：
    - `target / center`
    - `fov`
  - 因此当前实现优先保证“出生点位置 + 朝向稳定”，不追求完整还原原始 target/fov
- LCC2 当前结论：
  - 可读成果包中仍未发现等价于 `spawnPoint` 的明确出生点字段
  - 本轮不改 LCC2 默认视角算法，继续沿用 `sdkBounds / bounds` 链路
  - 本轮只增加开发态 runtime 诊断，输出：
    - `LCCRender` 是否存在 `getMeta / getBounds / setCamera`
    - runtime instance 的可枚举 key
    - `getMeta()` 顶层字段摘要
    - `camera / view / home / default / spawn / origin / transform / bounds` 可疑字段摘要
    - runtime instance 是否直接带 `defaultView / camera / homeView`
- 明确禁止项保持不变：
  - 不重新启用 `bestTrajectoryPose`
  - 不使用 `poses` 第 N 帧作为默认出生点
  - 不把 LCC / LCC2 视角逻辑扩散到其他模型格式

### 14.21 bounds center home view 收口

- 修改时间：`2026-06-06`
- 本轮范围：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/model-viewer-architecture.md`
- 是否修改后端 / 数据库 / Prisma / OSS / ZIP / dataPath：
  - 否
- 当前人工结论：
  - `LCC attrs.lcp.spawnPoint` 已可读取
  - 但 `spawnPoint.rotation` 人工验收后仍会导致默认视角发斜
  - `LCC2` 仍未发现可读出生点字段
  - `poses` 轨迹与 `bestTrajectoryPose` 继续禁用，不再参与默认视角
- LCC / LCC2 默认视角新优先级：
  1. `defaultCameraJson`
  2. `boundsCenterHomeView`
  3. Three `bounds` fallback
- 当前明确不再用于默认视角的来源：
  - `spawnPoint.rotation`
  - `firstTrajectory`
  - `bestTrajectoryPose`
  - `poses[].T / poses[].R / ts`
  - 成果包里未证实可靠的其他轨迹字段
- `spawnPoint` 的保留方式：
  - 仍按 `.lcc` 同目录读取 `attrs.lcp`
  - 仍解析：
    - `spawnPoint.position`
    - `spawnPoint.rotation`
  - 但只用于开发态诊断日志
  - 不再生成默认相机快照
  - 不再影响 `resetView`
- `boundsCenterHomeView` 算法：
  - 优先使用 SDK / runtime `getBounds()`
  - 若 SDK bounds 不可用，再使用 Three `Box3`
  - 计算：
    - `center = bounds center`
    - `size = bounds size`
    - `maxDim = max(size.x, size.y, size.z)`
  - `target = center`
  - 固定朝向使用官方示例前向方向的反方向布置相机，不再依赖 `spawnPoint.rotation`
  - `distance` 基于 `camera.fov` 与 `maxDim` 联合计算，当前实现会取：
    - `fitDistance * 0.85`
    - `maxDim * 0.85`
    - `6`
    三者中的最大值
  - `heightOffset = size.y * 0.05`
  - `camera.position = center - officialForward * distance + (0, heightOffset, 0)`
  - `camera.up = (0, 1, 0)`
  - `camera.lookAt(center)`
  - `controls.target.copy(center)`
- `resetView` 行为：
  - 若存在 `defaultCameraJson`，回到 `defaultCameraJson`
  - 否则回到 `boundsCenterHomeView`
  - 不 remount
  - 不回到 `spawnPoint`
  - 不回到 `bestTrajectoryPose`
- LCC / LCC2 一致性：
  - 默认视角算法已统一
  - 差异只保留在：
    - `useLcc2`
    - 加载参数
    - 入口文件格式
  - 默认视角不再按 `LCC / LCC2` 分叉
- 开发环境日志（每次加载仅输出一次）：
  - `boundsSource`
  - `center`
  - `size`
  - `maxDim`
  - `distance`
  - `cameraPosition`
  - `target`
  - `up`
  - `resetViewSource`
  - `skippedSpawnPointRotation`

### 14.22 默认视角最终收口与残留清理

- 修改时间：`2026-06-06`
- 本轮范围：
  - `web/components/models/lcc-viewer.tsx`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/model-viewer-architecture.md`
  - `docs/dev-checkpoint.md`
- 是否修改 `dataPath` / 后端 / 数据库 / Prisma / OSS / ZIP：
  - 否
- 最终默认视角主链路仅保留：
  1. `defaultCameraJson`
  2. `boundsCenterHomeView`
  3. `bounds` fallback
- 已从运行代码中删除或停用的旧策略残留：
  - `bestTrajectoryPose`
  - `firstTrajectory`
  - `poses` 轨迹默认视角猜测
  - `spawnPoint.rotation` 默认朝向计算
- `spawnPoint` 的最终定位：
  - 仅用于 `LCC attrs.lcp` 可读性诊断
  - 仅保留：
    - `attrsPath`
    - `rawPosition`
    - `rawRotation`
    - `resolvedPosition`
    - `skippedRotation`
    - `fallbackReason`
  - 不进入最终 `defaultSnapshot`
  - 不进入 `resetView`
- 已删除的无用代码类别：
  - 轨迹 pose 类型定义
  - trajectory candidate 构建
  - trajectory scoring
  - trajectory scan indices
  - best trajectory 选择
  - `_loadPoseSnapshot(...)`
  - `_buildSpawnPointSnapshot(...)`
  - 仅服务于旧 spawnPoint 旋转试算的 quaternion helper
- 开发日志收口：
  - 保留：
    - `defaultViewSource`
    - `boundsSource`
    - `center`
    - `size`
    - `maxDim`
    - `distance`
    - `cameraPosition`
    - `target`
    - `up`
    - `resetViewSource`
    - `skippedSpawnPointRotation`
    - `spawnPointDiagnostic`
  - 删除：
    - `posesSource`
    - `usedSpawnPoint`
    - `usedPosesJson`
    - `bestTrajectoryPose` 相关评分/候选日志
    - 轨迹摘要日志
- `resetView` 最终行为：
  - 若存在 `defaultCameraJson`，回到 `defaultCameraJson`
  - 否则回到 `boundsCenterHomeView`
  - 若默认快照不可用，再执行当前 `bounds` fit 兜底
- 当前结论：
  - `LCC / LCC2` 默认视角最终采用 `boundsCenterHomeView`
  - `spawnPoint.rotation` 人工验证后仍斜，已停用
  - `poses / bestTrajectoryPose` 已废弃，不参与默认视角
  - `dataPath`、后端、OSS / ZIP 未改

### 14.23 controlMode 默认 walk + iframe 焦点 + firstFrameState overlay 三项修复

- 修改时间：`2026-06-20`
- 本轮范围：
  - `web/components/models/lcc-viewer.tsx`
  - `web/components/models/model-viewer-shell.tsx`
  - `web/components/pages/model-detail-page.tsx`
  - `web/components/pages/model-share-viewer-page.tsx`
  - `web/app/viewer/lcc/[id]/page.tsx`
  - `docs/lcc-web-sdk-integration.md`
  - `docs/dev-checkpoint.md`
- 是否修改后端 / 数据库 / Prisma / OSS / ZIP / dataPath：
  - 否
- 本轮问题：
  - LCC/LCC2 模型默认第一人称模式（walk）下 WASD 不响应
  - Loading 动画到 92% 左右提前退场，模型还没真正显示
- 根因链（三个独立问题）：

  **问题一：首次 applyControlMode 被 guard 跳过（ff2fb40）**
  - `lcc-viewer.tsx` 中 controlMode 切换由 `applyControlMode` 执行，但其函数体开头有一个防重入 guard `if (controlModeRef.current === mode) return;`
  - `initialControlMode` 虽然从 props 拿到 `"walk"`，但 `controlModeRef.current` 默认初始值也是 `"walk"`，导致 guard 拦截首次 apply
  - 修复：`applyControlMode` 不再直接 `return`，改为先执行 `controls.enabled = (mode !== "walk")`，仅在 mode 未变化且 controls 状态一致时才跳过
  - 文件：`lcc-viewer.tsx`

  **问题二：模型切换时 controlMode 被重置为 orbit（b63794c）**
  - `model-viewer-shell.tsx` 在模型切换时重新挂载 `LccViewer`，但 `controlMode` props 在用户切换模型后恢复默认值 `"orbit"`
  - 修复：在 `LccViewer` unmount 时将当前 controlMode 保存到外层共享变量，remount 时复用
  - 文件：`model-viewer-shell.tsx`

  **问题三：iframe 没有焦点，WASD 不触发（633d49f + 879d414）**
  - LCC 模型在 `/models/[id]` 和 `/models/[id]/view` 中通过 iframe 加载 `/viewer/lcc/[id]`
  - iframe 没有焦点时，iframe 内 `document.addEventListener("keydown", ...)` 不会被触发
  - 修复：
    - `model-detail-page.tsx`：`handleLccIframeLoad` 中调用 `lccIframeRef.current.focus()` + `setTimeout(600)` 兜底 + `tabIndex={0}`
    - `model-share-viewer-page.tsx`：同上修复
    - `page.tsx`：viewer 容器 `tabIndex={0}` + `outline-none` + auto-focus useEffect（模型加载完成后聚焦）

  **问题四：overlay 在首帧尚未就绪时提前消失（3ad12cf）**
  - `showOverlay = processingBlocked || viewerStatus !== "loaded"` 在 `viewerStatus` 变为 `"loaded"` 时隐藏 overlay
  - 但 `completeViewerLoading` 触发时首帧渲染还未完成（`firstFrameRenderedRef = false`），模型画面还在加载中
  - 修复：新增 `firstFrameState` React state，`showOverlay` 改为 `... || !firstFrameState`，overlay 保持显示直到首帧 canvas 内容就绪
  - 文件：`lcc-viewer.tsx`

  **问题五：viewerReady 实验及回滚（5b7b79d → 79667b0）**
  - 尝试用更保守的 `viewerReadyState`（延迟 800ms + RAF x2 + canMove + canvas 连通）替代 `firstFrameState`，但导致模型卡 Loading
  - 已经回滚：删除 `viewerReadyRef / viewerReadyState / readyFinalizeTimerRef / scheduleViewerReadyFinalize / data-lcc-viewer-ready / onViewerReady prop / SHUJING_LCC_VIEWER_READY postMessage`
  - `showOverlay` 恢复为依赖 `firstFrameState`
  - 父页面轮询恢复为 `data-lcc-first-frame`
  - 文件：`lcc-viewer.tsx`, `page.tsx`, `model-detail-page.tsx`, `model-share-viewer-page.tsx`

- 本轮提交记录：
  - `ff2fb40` fix: initialControlMode 强制首次 apply walk
  - `b63794c` fix: keep viewer shell default control mode as walk
  - `633d49f` fix: focus LCC iframe for default keyboard controls
  - `879d414` fix: focus viewer container in LCC iframe page
  - `3ad12cf` fix: keep loading overlay until first frame is ready
  - `5b7b79d` fix: wait for LCC viewer ready before hiding loading（已回滚）
  - `79667b0` revert: restore LCC loading readiness flow（回滚 5b7b79d）
- 构建或测试命令：
  - `cd web && pnpm build`
- 构建或测试结果：
  - 每次 `pnpm build` 均通过
- 当前结论：
  - `initialControlMode` 首次 apply walk 已修复
  - 模型切换后默认 walk 已修复
  - iframe focus + tabIndex 已修复（详情页 + 分享页 + iframe 内部容器）
  - overlay 不再在首帧就绪前提前消失
  - `viewerReady` 实验因导致模型卡 Loading 已经回滚
  - 保留当前 `firstFrameState` + `data-lcc-first-frame` 作为 loading 完成条件
- 当前风险点：
  - `firstFrameState` 判定阈值较低（仅需 3 个非背景像素 + 0.3% 比例），不排除部分模型在首帧稀疏像素时判定过早
  - `attrs.lcp 404` 不影响加载，但控制台会产生一次 404 请求（SDK 0.6.1 不请求 attrs.lcp，是前端 `loadLccSpawnPointSnapshot` 主动 fetch）
- 下一步建议：
  - 若再次出现 overlay 提前消失，可调整 `LCC_MODEL_PIXEL_MIN_COUNT` 或 `LCC_MODEL_PIXEL_RATIO_THRESHOLD` 提高首帧判定门槛
  - 模型处理失败（`processed/lcc/16/` 目录不存在）的问题需在后端排查，与前端加载逻辑无关

### 14.24 帮助面板 + 第一人称 walk 鼠标交互（2026-06-20）

- 帮助面板：`web/components/models/model-viewer-help.tsx`
  - 居中半透明浮层；仅 tab「第一人称 / 枢轴」
  - 不含数字人、第三人称、新手指引、未接入能力
  - tab 切换只改帮助文案，不改 viewer `controlMode`
- 第一人称鼠标（`lcc-viewer.tsx`，项目层，非 SDK）：
  - 滚轮：沿视线前后移动 `camera.position`（不改 FOV）
  - 右键拖动：平移位置（不改 yaw/pitch；`WALK_PAN_LOOK_RATIO = 0.5`）
  - walk 下 **不**启用 OrbitControls
- UI 命名：`walk` →「第一人称」；`orbit` →「枢轴」（帮助 tab；工具栏可为「枢轴模式」短文案）
- 帮助打开：`LccViewer` 接收 `isHelpOpen`，屏蔽 walk 的 wheel / pointer
- 未改：`LCCRender.load`、`dataPath`、默认视角链、`launchView`、`resetView`、iframe 完成协议
- 构建：`cd web && pnpm build` 通过

### 14.25 SDK 0.6.1 运行时升级说明

- 自 0.6.0 升级后，静态资源路径与文件名变更（见文首「当前运行时口径」）
- `web/public/vendor/lcc-web/` 现仅保留 `0.6.1/` 目录
- 仓库仍保留 `LCC-Web-0.6.0/` 作历史对照；**运行时以 0.6.1 + `lcc-web-sdk.*` 为准**

### 14.26 手机分享横屏游戏化查看器第一版（Step 1~7，Commit `ba7c895`，2026-06-21）

> 架构与验收详见 `docs/model-viewer-architecture.md` §十二·续一～续七、`docs/frontend-acceptance-checklist.md` §4.2.1、`docs/dev-checkpoint.md`「手机分享横屏 Viewer（第一版）」。  
> **本节仅记录与 LCC iframe / walk 输入链相关的边界**。

#### 阶段提交

- Commit：`ba7c895` — `feat: add mobile landscape share viewer`
- 构建：`cd web && pnpm build` 通过

#### Step 1：分享外层壳（`model-share-viewer-page.tsx`）

- 工具：`web/lib/use-mobile-viewer.ts`（`useMobileViewer`、`buildLccShareIframeSrc`）
- 手机竖屏：全屏阻断「请横屏浏览模型」，不挂载 iframe
- 手机横屏：轻量顶栏 + iframe `?context=share&readonly=1&mobile=1`
- 桌面分享：iframe `?context=share&readonly=1`（无 `mobile=1`）
- `readonly=1` 在 iframe 页隐藏「保存启动视图」；保留自动全屏 / 横屏锁定 / 降级按钮

#### Step 2~4：iframe 内 walk 触控（`mobile-lcc-game-controls.tsx` + `lcc-viewer.tsx`）

- 挂载：`web/app/viewer/lcc/[id]/page.tsx`，条件 `mobile=1 && controlMode===walk && !isHelpOpen && ready`
- 左下虚拟摇杆 + 右下升/降 → `setMovementInput`
- 右侧 60% 单指 look → `lookByDelta`；双指 pinch/pan → `moveAlongView` / `panByDelta`
- `mobile=1` 时隐藏 `ModelViewerToolbar`
- handle 类型：`web/components/models/viewers/types.ts`

#### Step 5~7：帮助 + chrome + orbit

- `mobile-lcc-help-overlay.tsx`：双 tab 触屏说明，不展示键鼠
- `mobile-lcc-viewer-chrome.tsx`：第一人称 / 枢轴 / 重置 / 帮助
- orbit 复用 OrbitControls 触屏；walk 时隐藏 game controls

#### 与 SDK / walk 的关系

- 移动输入仍走项目层 walk 循环（与桌面 WASD / EQ 同一 `setMovementInput` 通道）
- 转头 / 双指复用 `lcc-viewer.tsx` 内 walk 相机逻辑，**未改** `LCCRender.load`、`dataPath`、`resetView` 优先级链
- 触控层 `preventDefault` / `touch-action: none`，避免与 canvas / OrbitControls 冲突
- 外层 Loading 仍轮询子文档 `data-lcc-first-frame=true`（非仅 `onLoadedStable`）
- 子文档 `data-lcc-loaded` / `data-lcc-complete-reason=onLoadedStable` **未改**

#### 红线未改

- 未改 `server/`、Prisma、OSS / 上传 / ZIP
- 未改 `LCCRender.load`、`.lcc/.lcc2` 入口 URL `dataPath`
- 未改 `launchView / sdkInitialCamera / defaultCamera / boundsCenterHomeView` 链
- 未改 `resetView` 算法、`onLoadedStable` 完成协议
- 未改桌面 `ModelViewerToolbar` / `ModelViewerHelp`

#### 已知风险

1. 需真机验收 iPhone Safari / 微信 / Android Chrome
2. 外层顶栏「第一人称」静态徽章可能与 iframe orbit 不同步
3. 竖屏 hydration 前可能短暂闪出非 `mobile=1` iframe
4. 小屏横屏 chrome 四按钮可能拥挤
5. 触屏灵敏度需真机微调
6. 分享外层 Loading 以 first-frame 收起；真机闪屏时再评估 `onLoadedStable` 对齐
