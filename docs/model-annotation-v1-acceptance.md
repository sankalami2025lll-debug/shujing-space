# 模型空间热点标注 V1 验收与封板记录

> 文档用途：封板「模型空间热点标注 V1」。记录功能定位、完成范围、数据结构口径、后端接口、迁移与部署注意、OSS 口径、前端接入位置、视觉规则、飞行跳转规则、纯净模式、owner-only 规则、红线、已修复问题、暂不做项、验收清单与构建要求。
> 文档性质：验收与封板记录，不作为业务代码修改依据。如需变更功能，先更新本文档并经评审。

---

## 1. 功能定位

- 功能名称：模型空间热点标注 / 空间导览标注。
- 定位：在 LCC / LCC2 iframe Viewer 之上叠加空间标注，用于模型导览与重点点位说明。
- owner 增强功能：owner 可新增 / 编辑 / 删除标注，可设置标题、描述、anchorPosition、保存视角。
- 游客只读展示功能：游客只能看到标注成果、点击导览、查看内容框。
- 不是评论系统：标注没有评论、回复、点赞、时间线，不要往社交评论方向扩展。
- V1 优先支持 LCC / LCC2 iframe viewer，非 LCC / LCC2 全格式适配不在 V1 验收范围。

---

## 2. 当前完成范围

V1 已完成并封板：

- owner 新增标注。
- 点击模型真实点位生成 `anchorPosition`（通过 `pickPoint` 拾取模型表面点）。
- 保存标题、描述、标注点、保存视角。
- 编辑标注。
- 删除标注。
- 游客默认显示标题胶囊 + 小箭头 + 标注点。
- 点击标题或标注点快速飞行到保存视角（`flyToView`）。
- 飞行结束后展开内容框。
- 内容框可关闭，关闭后恢复标题态。
- 纯净模式隐藏全部标注。
- readonly 分享页只读展示。
- 手机分享页可看标注并使用纯净模式。

---

## 3. 数据结构口径

### 3.1 cameraSnapshot 扁平结构

`annotation.cameraSnapshot` 在标注存储与接口中统一使用扁平结构：

```ts
interface AnnotationCameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  near: number;
  far: number;
}
```

### 3.2 与 ModelLaunchView 的关系

- `getCurrentView` / `applyView` 仍使用 `ModelLaunchView` 包装结构（含 `version` / `viewerKind` / `snapshot`）。
- 保存前：`ModelLaunchView` → `AnnotationCameraSnapshot`（扁平化）。
- 点击时：`AnnotationCameraSnapshot` → `ModelLaunchView`（包装回 viewer 可用的结构）再交给 `flyToView` / `applyView`。
- 后端兼容旧包装数据，新保存统一扁平。
- `anchorPosition` / `anchorNormal` 为数组结构 `[x, y, z]`。

---

## 4. 后端接口

### 4.1 接口列表

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/models/:modelId/annotations` | 获取标注列表 |
| POST | `/api/models/:modelId/annotations` | 新增标注 |
| PATCH | `/api/models/:modelId/annotations/:annotationId` | 编辑标注 |
| DELETE | `/api/models/:modelId/annotations/:annotationId` | 删除标注 |
| POST | `/api/models/:modelId/annotations/:annotationId/media` | 新增标注媒体 |
| DELETE | `/api/models/:modelId/annotations/:annotationId/media/:mediaId` | 删除标注媒体 |

### 4.2 权限

- GET：可查看模型的人可读 `active`；owner 可读 `active` / `hidden`。
- POST / PATCH / DELETE / media：仅 owner。
- 未登录 → 401。
- 非 owner → 403。

---

## 5. 数据库迁移

### 5.1 迁移记录

- 迁移名：`20260707150000_add_model_annotations`。
- 新增表：`model_annotations`。
- 新增表：`model_annotation_media`。

### 5.2 部署注意事项

- 部署环境必须执行：`pnpm prisma migrate deploy`。
- `migrate deploy` 后需要确保 Prisma Client 已 `generate`。
- 若 `GET` / `POST` `/api/models/:modelId/annotations` 返回 500，优先检查 Prisma `P2021`（关系 / 表不存在），通常是迁移未执行或 Prisma Client 未刷新。
- 排查顺序：迁移是否执行 → Prisma Client 是否 generate → server 是否使用了最新 build。

---

## 6. OSS 口径

- 当前项目对象存储是阿里云 OSS。
- 标注媒体使用 `objectKey` / `url` 字段。
- 不使用 R2。
- 不新增 `r2Key`。
- 图片 / 全景 / 视频 V1 可在数据结构中预留字段，视频和全景播放不作为 V1 验收项。

---

## 7. 前端接入位置

主要文件：

- `web/app/viewer/lcc/[id]/page.tsx` — 标注状态管理、点击飞行、内容框展开时序、纯净模式 / 管理模式切换。
- `web/components/models/lcc-viewer.tsx` — `flyToView` 实现、`flyActiveRef` 渲染循环门控、`applyCameraSnapshotPoseExact` 共享落点逻辑。
- `web/components/models/model-viewer-toolbar.tsx` — 桌面工具栏纯净模式 / 标注管理入口。
- `web/components/models/mobile-lcc-viewer-chrome.tsx` — 手机工具栏纯净模式入口。
- `web/components/models/annotations/model-annotation-layer.tsx` — 标注 overlay 渲染、投影节流、选点遮罩、内容框定位。
- `web/components/models/annotations/model-annotation-types.ts` — 标注视觉常量、定位工具函数、cameraSnapshot 转换函数、纯净模式偏好。
- `web/lib/api/annotations.ts` — 前端标注 API 客户端。
- `web/lib/types.ts` — 前端标注类型定义。

---

## 8. 标注视觉规则

- 收起态：标题胶囊 + 小三角箭头 + 标注点。
- 不使用长引线。
- 标题和内容框默认在标注点上方。
- 水平以标注点为中心。
- 左右只 clamp 内容 UI，不吸附标注点；标注点仍跟随真实模型投影。
- 内容框是屏幕 UI，不随模型缩放放大，不随相机距离放大。
- 内容框样式保持黑灰极简，不做花哨发光、不加大面积蓝色渐变。

---

## 9. 飞行跳转规则

- 点击标题或标注点后调用 `flyToView`。
- 默认 `550ms` 快速飞行（限制 250 ~ 1200ms）。
- 缓动：`easeOutCubic`。
- 飞行期间隐藏 Annotation Overlay，避免投影乱跳。
- 飞行结束后展开内容框。
- `flyToView` 最终落点必须复用 `applyView` 已验证正确的相机快照应用逻辑（`applyCameraSnapshotPoseExact` / `applyLaunchViewSnapshotToCamera`）。
- 不允许单独用 `Object3D` / `lookAt` 推导目标 quaternion 作为最终真相（曾因此导致目标方向反向、飞到天空）。
- 新飞行取消旧飞行（令牌机制）。
- 用户 `pointerdown` / `wheel` / `WASD` / `QE` / `Shift` / 方向键可取消飞行。
- Promise 不能悬挂：取消、卸载、动画完成都必须 resolve。
- R 重置视角不能被标注飞行污染：`flyToView` 不写 `defaultViewRef` / `launchViewSnapshotRef`。

---

## 10. 纯净模式规则

- 所有查看者可用。
- 只隐藏当前查看者 UI，不写数据库（仅写 localStorage 偏好）。
- 隐藏标题、箭头、标注点、内容框。
- owner 进入标注管理时临时显示标注，退出后恢复之前纯净模式状态。
- 手机分享页右上工具也支持纯净模式。

---

## 11. owner-only 规则

- 标注管理仅 owner 可见。
- readonly 分享页不可编辑。
- 非 owner 不显示管理入口。
- 游客只能看成果和点击导览。

---

## 12. 禁止触碰红线

- 不修改 `LCCRender.load(...)`。
- 不恢复目录 `dataPath` 模式。
- 不依赖 `meta.lcc` / `meta.lcc2` / `meta.splat`。
- 不破坏 `entryUrl` 入口文件 URL 规则。
- 不改后端模型加载链路。
- 不改 OSS 口径。
- 不破坏手机分享页 `mobile=1`。
- 不破坏测量、剖切、点云、帮助、保存启动视图、第一人称 / 枢轴。
- 不把标注做成评论系统。

---

## 13. V1 已修复问题记录

- 空标注列表时新增入口被早返回杀掉 → 调整 layer 渲染门控，管理模式下即使标注为空也显示新增入口与选点遮罩。
- `cameraSnapshot` DTO 与前端 `ModelLaunchView` 结构不一致 → 前端保存前扁平化、点击时包装，后端校验扁平结构并兼容旧包装数据。
- 数据库迁移未执行导致 `P2021` / 500 → 执行 `migrate deploy` + `prisma generate` + 重新 build。
- 长引线视觉混乱 → 改为标题胶囊 + 小箭头，移除长引线渲染。
- 内容框定位偏移 → 改为上方居中固定屏幕 UI，clamp 到视口安全边距，不随模型缩放放大。
- 点击闪现跳转 → 改为 `flyToView` 快速漫游。
- 飞行期间 Overlay 重投影乱跳 → 飞行中隐藏标注 overlay 并暂停 `reproject`。
- `flyToView` 使用 `Object3D.lookAt` 导致目标方向反向 → 最终落点改回复用 `applyView` 正确落点逻辑（`applyCameraSnapshotPoseExact`）。
- 飞行结束后内容框展开时序问题 → 下一帧再展开，并修复 layer 在投影恢复窗口的误收起逻辑。

---

## 14. V1 暂不做

- 全景播放器。
- 视频播放器。
- 导览路线自动播放。
- 标注分组。
- 标注搜索。
- 标注拖拽避让。
- BIM GUID 构件级绑定。
- 移动端编辑标注。
- 非 LCC / LCC2 全格式标注适配。

---

## 15. 验收清单

### 15.1 桌面 owner

- [ ] 进入模型查看页，工具栏可见「标注管理」入口。
- [ ] 进入标注管理后可新增标注。
- [ ] 点击模型表面可拾取 anchorPosition。
- [ ] 可填写标题、描述并保存。
- [ ] 保存后标注列表出现新标注。
- [ ] 可编辑已有标注。
- [ ] 可删除已有标注。
- [ ] 退出标注管理后恢复进入前的纯净模式状态。

### 15.2 游客

- [ ] 可见标题胶囊 + 小箭头 + 标注点。
- [ ] 点击标题可飞行到保存视角并展开内容框。
- [ ] 点击标注点行为与点击标题一致。
- [ ] 内容框关闭后恢复标题态。
- [ ] 纯净模式可隐藏全部标注。
- [ ] 不显示标注管理入口。

### 15.3 readonly 分享页

- [ ] 只读展示标注。
- [ ] 不可编辑 / 新增 / 删除。
- [ ] 点击标注可飞行并展开内容框。

### 15.4 手机分享页

- [ ] 可见标注并点击导览。
- [ ] 飞行结束后内容框展开。
- [ ] 右上工具支持纯净模式。
- [ ] 摇杆与触控不受标注影响。
- [ ] 飞行中触控可取消动画且标注层不永久隐藏。

### 15.5 核心 Viewer 功能回归

- [ ] 重置视角（R）回到原默认视角，不被标注飞行污染。
- [ ] 保存启动视图正常。
- [ ] 第一人称 / 枢轴切换正常。
- [ ] 测量功能正常。
- [ ] 剖切功能正常。
- [ ] 点云显示切换正常。
- [ ] 帮助面板正常。
- [ ] 默认启动视图与 entryUrl / dataPath 规则未被破坏。

---

## 16. 构建要求

- 前端：`cd web && pnpm build`。
- 后端：`cd server && pnpm build`。
- 数据库环境需执行：`pnpm prisma migrate deploy`，并确保 Prisma Client 已 `generate`。
