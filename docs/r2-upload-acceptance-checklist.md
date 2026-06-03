**本地验收 Checklist**
- 只做配置与验收指导，不改代码。
- 这份清单按你当前项目的真实链路设计：`presign -> PUT R2 -> callback -> POST /api/models`。
- 建议在 Chrome DevTools 的 `Network` 面板逐项勾选。

**验收前准备**
- [ ] PostgreSQL 已启动，数据库可连通
- [ ] 后端 `server` 已启动在 `http://localhost:4000`
- [ ] Next 前端 `web` 已启动在 `http://localhost:3000`
- [ ] `server/.env` 已填入真实 R2 配置，但未写入 GitHub
- [ ] R2 bucket 已配置 CORS，至少允许 `http://localhost:3000`
- [ ] 浏览器已登录一个普通用户账号
- [ ] DevTools 已打开 `Network`
- [ ] 已勾选 `Preserve log`
- [ ] 已勾选 `Disable cache`
- [ ] 已清空一次 Network 历史记录

**建议的 Network 过滤方式**
- [ ] 先过滤 `api/uploads`
- [ ] 再额外观察目标域名为 `r2.cloudflarestorage.com` 的请求
- [ ] 最后过滤 `api/models`

**测试文件准备**
- [ ] 准备一个合法模型文件，如 `test.glb`
- [ ] 文件大小小于 `MAX_MODEL_SIZE_MB`
- [ ] 如需测封面，再准备一张 `jpg/png/webp`
- [ ] 文件扩展名属于项目白名单

**页面入口**
- [ ] 打开 `http://localhost:3000/models`
- [ ] 点击“发布模型”
- [ ] 填写模型名称
- [ ] 选择模型分类
- [ ] 选择模型文件
- [ ] 可选：选择封面文件
- [ ] 不填写 `viewerUrl`，本轮专测真实 R2 文件上传

**第一步：`presign`**
- [ ] 点击“发布模型”提交后，Network 出现 `POST /api/uploads/presign`
- [ ] 该请求状态码为 `200`
- [ ] Request Headers 中带有登录态 `Authorization: Bearer ...`
- [ ] Request Payload 中包含：
  - [ ] `kind`
  - [ ] `fileName`
  - [ ] `mime`
  - [ ] `size`
- [ ] Response 中包含：
  - [ ] `uploadUrl`
  - [ ] `r2Key`
  - [ ] `requiredHeaders`
  - [ ] `publicUrl`
  - [ ] `expiresIn`
- [ ] `r2Key` 前缀符合预期，例如：
  - [ ] `model/<当前用户ID>/...`
  - [ ] 若是封面则为 `cover/<当前用户ID>/...`

**`presign` 失败排查**
- [ ] 若状态码为 `503`，优先检查 R2 环境变量是否配全
- [ ] 若状态码为 `401`，说明当前未登录或 token 失效
- [ ] 若状态码为 `400`，检查文件扩展名或大小是否超限
- [ ] 若前端 toast 显示“R2 对象存储未配置”，说明后端未拿到有效 R2 配置

**第二步：浏览器 `PUT` 到 R2**
- [ ] `presign` 成功后，Network 中出现一个对 `uploadUrl` 的 `PUT` 请求
- [ ] 该请求目标域名不是 `localhost:4000`
- [ ] 该请求目标域名是 R2 S3 兼容域名
- [ ] `PUT` 请求状态码为 `200` 或 `204`
- [ ] `PUT` 请求没有被浏览器 CORS 拦截
- [ ] `Request Headers` 中包含与 `presign.requiredHeaders` 一致的 `Content-Type`
- [ ] `Request Payload`/`Request` 的大小与本地文件一致

**`PUT` 失败排查**
- [ ] 若浏览器直接报 CORS error，优先检查 Bucket CORS
- [ ] 若状态码为 `403`，检查：
  - [ ] `R2_ACCESS_KEY_ID`
  - [ ] `R2_SECRET_ACCESS_KEY`
  - [ ] token 权限是否覆盖目标 bucket
  - [ ] `R2_ENDPOINT` 是否正确
- [ ] 若签名相关报错，检查 `Content-Type` 是否与 presign 阶段一致
- [ ] 若本地打开的是 `127.0.0.1:3000`，确认 CORS 是否也放行了 `127.0.0.1`

**第三步：`callback`**
- [ ] `PUT` 成功后，Network 中出现 `POST /api/uploads/callback`
- [ ] 该请求状态码为 `200`
- [ ] Request Payload 中包含：
  - [ ] `kind`
  - [ ] `r2Key`
  - [ ] `originalName`
  - [ ] `mime`
  - [ ] `size`
- [ ] Response 中包含：
  - [ ] `fileId`
  - [ ] `url`
  - [ ] `r2Key`
  - [ ] `kind`
- [ ] 返回的 `url` 以 `R2_PUBLIC_BASE` 开头
- [ ] 返回的 `r2Key` 与 `presign` 返回的一致

**`callback` 失败排查**
- [ ] 若状态码为 `404` 或提示对象不存在，说明 `PUT` 并未真正成功落到 R2
- [ ] 若状态码为 `403`，说明 `r2Key` 与当前登录用户不匹配
- [ ] 若状态码为 `400`，检查：
  - [ ] R2 `HeadObject` 读到的 `Content-Type` 是否命中白名单
  - [ ] 文件大小是否超出后端限制
  - [ ] `originalName` 扩展名是否被后端接受

**第四步：`POST /api/models`**
- [ ] `callback` 成功后，Network 中出现 `POST /api/models`
- [ ] 该请求状态码为 `200`
- [ ] Request Payload 中包含：
  - [ ] `title`
  - [ ] `type`
  - [ ] `visibility`
  - [ ] `modelFileId`
- [ ] 若同时上传封面，还包含：
  - [ ] `coverFileId`
- [ ] Response 中返回新模型详情
- [ ] 返回数据中的：
  - [ ] `modelUrl` 指向 R2 公共地址
  - [ ] `coverUrl` 指向封面公共地址
  - [ ] `viewerType` 为 `native` 或符合当前逻辑
  - [ ] `fileFormat` 与扩展名一致

**`POST /api/models` 失败排查**
- [ ] 若状态码为 `400`，检查 `modelFileId` / `coverFileId` 是否有效
- [ ] 若状态码为 `401`，检查登录态是否丢失
- [ ] 若返回“文件不存在或无权限”，说明 fileId 不属于当前用户
- [ ] 若缺少模型名、分类等必填项，也会被挡住

**第五步：检查 R2 控制台**
- [ ] 打开 Cloudflare Dashboard
- [ ] 进入 `R2 object storage`
- [ ] 打开目标 bucket
- [ ] 进入 `Objects`
- [ ] 能看到刚上传的新对象
- [ ] 对象 key 与 `presign/callback` 返回一致
- [ ] 如同时上传封面，也能看到 `cover/...` 对象
- [ ] 对象不依赖本地服务器目录存在

**第六步：检查 `model_files` 表**
- [ ] 连接本地 PostgreSQL
- [ ] 执行以下 SQL：

```sql
SELECT
  id,
  user_id,
  kind,
  original_name,
  r2_key,
  url,
  size,
  mime,
  created_at
FROM model_files
ORDER BY id DESC
LIMIT 20;
```

- [ ] 能看到刚新增的记录
- [ ] `kind` 为 `model` 或 `cover`
- [ ] `r2_key` 与 R2 控制台一致
- [ ] `url` 以 `R2_PUBLIC_BASE` 开头
- [ ] `size` 为正整数
- [ ] `mime` 合理，不为空
- [ ] `user_id` 为当前登录用户

**第七步：检查 `models` 表**
- [ ] 执行以下 SQL：

```sql
SELECT
  id,
  user_id,
  type,
  title,
  cover_url,
  model_url,
  viewer_type,
  allow_iframe,
  file_format,
  visibility,
  status,
  created_at
FROM models
ORDER BY id DESC
LIMIT 20;
```

- [ ] 能看到刚新增的模型记录
- [ ] `title` 与你提交的一致
- [ ] `type` 与前端所选分类一致
- [ ] `model_url` 为 R2 公共地址
- [ ] `cover_url` 为封面公共地址
- [ ] `viewer_type` 符合文件上传路径的预期
- [ ] `file_format` 与扩展名一致，如 `glb`
- [ ] `visibility` 与前端所选一致
- [ ] `status` 与后端规则一致

**第八步：前端结果确认**
- [ ] 发布成功后页面出现成功提示
- [ ] 返回模型列表页后能看到新模型
- [ ] 点击新模型可以进入详情页
- [ ] 详情页中的模型地址不是本地文件路径
- [ ] 浏览器控制台没有明显报错

**最终通过标准**
- [ ] `POST /api/uploads/presign` 成功
- [ ] 浏览器对 R2 的 `PUT` 成功
- [ ] `POST /api/uploads/callback` 成功
- [ ] `POST /api/models` 成功
- [ ] R2 控制台能看到对象
- [ ] `model_files` 表有新记录
- [ ] `models` 表有新记录
- [ ] 前端模型列表可见新模型
- [ ] 全流程未出现“本地存储兜底”或“伪造上传成功”

**快速判定失败位置**
- `presign` 都没过：后端 R2 配置问题
- `presign` 过了但 `PUT` 挂了：大概率是 R2 CORS 或签名/权限问题
- `PUT` 过了但 `callback` 挂了：大概率是 R2 对象未被正确确认，或 `mime/size` 被后端拦截
- `callback` 过了但 `POST /api/models` 挂了：大概率是 fileId 关联或表单字段问题

如果你要，我下一条可以继续直接给你一份“故障定位速查表”，按 `401 / 400 / 403 / 404 / 503 / CORS` 六类错误分别对应排查。