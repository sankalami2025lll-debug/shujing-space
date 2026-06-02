/**
 * 数境空间官网 数据库种子脚本 seed.ts
 *
 * 用途：把当前前端 UI 原型的静态数据 src/app/communityData.ts 清洗后灌入开发库，
 *       供后端接口开发与后台管理联调使用。
 *
 * 数据来源与清洗规则：
 * - color / pattern：纯前端卡片视觉效果，不属于业务数据，不入库。
 * - views("2.1k") → viewsCount(Int)；time("3天前") → createdAt(Timestamptz)，均在本脚本清洗。
 * - author（作者名）→ 去重生成种子用户，models.userId 关联。
 * - viewerUrl → models.modelUrl；有链接则 viewerType=sketchfab，无则 none。
 *
 * 幂等：全部使用 upsert + 固定主键，可重复执行不产生重复数据。
 * 红线：不写真实密钥；密码仅为开发占位哈希；不接 R2，封面 URL 为占位空串。
 */
import { PrismaClient, ViewerType, ModelStatus, ModelVisibility, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// 开发占位密码哈希（非真实密钥、非真实可用密码，仅供本地种子用户占位）
const DEV_PASSWORD_HASH = '$2b$10$devSeedPlaceholderHashNotForProductionUseOnly00000';

// communityData.ts 的原始静态数据（与前端保持一致，便于清洗映射）
// 注意：此处仅为种子用途的副本，正式数据未来由后端接口产生。
const rawModels = [
  { id: 1, title: '古建筑实景三维模型', type: '实景三维', tags: ['数字文旅', '实景重建', '沉浸展示'], author: '数境空间官方', views: '2.1k', likes: 368, time: '2天前', viewerUrl: 'https://sketchfab.com/models/722e900559cf41bdbf9acb8df606b3b8/embed?autospin=0.2&ui_theme=dark&ui_infos=0' },
  { id: 2, title: '商业空间云上展示模型', type: '实景三维', tags: ['商业空间', '云上营销', '在线展示'], author: '空间资产用户', views: '1.8k', likes: 245, time: '5天前' },
  { id: 3, title: '园区 BIM 管理模型', type: 'BIM 模型', tags: ['园区', 'BIM', '数字孪生'], author: '数境空间官方', views: '1.6k', likes: 210, time: '1周前', viewerUrl: 'https://sketchfab.com/models/cc89c1e265514cbab1234eba999683e1/embed?autospin=0.2&ui_theme=dark&ui_infos=0' },
  { id: 4, title: '建筑改造 BIM 模型', type: 'BIM 模型', tags: ['工程改造', '空间复核', '建筑管理'], author: '工程模型用户', views: '980', likes: 126, time: '2周前' },
  { id: 5, title: '建筑构件资产模型', type: '构件级模型', tags: ['建筑构件', '精细建模', '资产管理'], author: '模型创作者', views: '760', likes: 98, time: '3周前' },
  { id: 6, title: '机电设备构件模型', type: '构件级模型', tags: ['设备对象', '机电构件', '空间部件'], author: 'BIM 用户', views: '650', likes: 87, time: '1个月前' },
  { id: 7, title: '室内导航训练场景', type: '具身智能机器人训练场景', tags: ['室内导航', '机器人训练', '场景理解'], author: '数境空间官方', views: '1.2k', likes: 188, time: '3天前' },
  { id: 8, title: '园区巡检训练场景', type: '具身智能机器人训练场景', tags: ['园区巡检', '路径理解', '空间交互'], author: '数境空间官方', views: '1.1k', likes: 172, time: '4天前' },
  { id: 9, title: '影视游戏场景模型', type: '实景三维', tags: ['游戏影视', '真实场景', '数字资产'], author: '场景资产用户', views: '890', likes: 133, time: '2周前' },
  { id: 10, title: '历史建筑数字存档模型', type: '实景三维', tags: ['数字存档', '历史建筑', '长期保存'], author: '文旅模型用户', views: '1.4k', likes: 216, time: '1周前' },
];

// 4 个固定分类（与前端模型类型一一对应，驱动筛选与后台分类管理）
const categories = [
  { id: 1, name: '实景三维', slug: 'reality-3d', sort: 1 },
  { id: 2, name: 'BIM 模型', slug: 'bim', sort: 2 },
  { id: 3, name: '构件级模型', slug: 'component', sort: 3 },
  { id: 4, name: '具身智能机器人训练场景', slug: 'robot-training', sort: 4 },
];

// 类型名 → 分类 id 映射，用于 models.categoryId 关联
const typeToCategoryId: Record<string, number> = {
  实景三维: 1,
  'BIM 模型': 2,
  构件级模型: 3,
  具身智能机器人训练场景: 4,
};

// 站点全站配置占位（Footer 联系方式等），真实信息待业务方提供后由后台维护
const siteConfigs = [
  { key: 'contact_phone', value: '请填写' },
  { key: 'contact_email', value: '请填写' },
  { key: 'contact_address', value: '请填写' },
  { key: 'icp', value: '请填写' },
];

// 清洗 views 展示值："2.1k" → 2100、"980" → 980
function parseViews(views: string): number {
  const v = views.trim().toLowerCase();
  if (v.endsWith('k')) {
    return Math.round(parseFloat(v.slice(0, -1)) * 1000);
  }
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

// 清洗 time 相对时间展示值 → 具体创建时间（基于当前时间估算，仅用于排序/展示）
function parseRelativeTime(time: string, now = new Date()): Date {
  const ms = 24 * 60 * 60 * 1000;
  const match = time.match(/(\d+)\s*(天|周|个月|月)前/);
  if (!match) return now;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  let days = num;
  if (unit === '周') days = num * 7;
  else if (unit === '个月' || unit === '月') days = num * 30;
  return new Date(now.getTime() - days * ms);
}

async function main() {
  const now = new Date();

  // 1. 导入 4 个分类（幂等 upsert，固定 id）
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, slug: c.slug, sort: c.sort, isActive: true },
      create: { id: c.id, name: c.name, slug: c.slug, sort: c.sort, isActive: true },
    });
  }

  // 2. 导入种子用户：从 rawModels 的 author 去重 + 1 个管理员测试账号
  const authorNames = Array.from(new Set(rawModels.map((m) => m.author)));
  // author 名 → 用户 id 映射（用于 models.userId 关联）
  const authorToUserId: Record<string, number> = {};
  // 管理员占用 id=1，普通作者从 id=2 起，保证幂等可重复
  await prisma.user.upsert({
    where: { id: 1 },
    update: { nickname: '系统管理员', role: UserRole.admin },
    create: {
      id: 1,
      nickname: '系统管理员',
      email: 'admin@example.com',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.admin,
    },
  });

  let uid = 2;
  for (const name of authorNames) {
    const userId = uid++;
    authorToUserId[name] = userId;
    await prisma.user.upsert({
      where: { id: userId },
      update: { nickname: name },
      create: {
        id: userId,
        nickname: name,
        passwordHash: DEV_PASSWORD_HASH,
        role: UserRole.user,
      },
    });
  }

  // 3. 导入 10 条模型数据（清洗 views/time，关联 category/user，补默认业务字段）
  for (const m of rawModels) {
    const hasViewer = Boolean(m.viewerUrl);
    await prisma.model.upsert({
      where: { id: m.id },
      update: {
        title: m.title,
        type: m.type,
        tags: m.tags,
        categoryId: typeToCategoryId[m.type] ?? null,
        userId: authorToUserId[m.author],
        viewsCount: parseViews(m.views),
        likesCount: m.likes,
        modelUrl: m.viewerUrl ?? null,
        viewerType: hasViewer ? ViewerType.sketchfab : ViewerType.none,
        allowIframe: true,
        status: ModelStatus.published,
        visibility: ModelVisibility.public,
      },
      create: {
        id: m.id,
        title: m.title,
        type: m.type,
        tags: m.tags,
        scenes: [],
        description: `${m.title}（示例数据，来源于前端原型 communityData）`,
        coverUrl: '', // 不接 R2，封面占位空串；真实封面待上传流程
        categoryId: typeToCategoryId[m.type] ?? null,
        userId: authorToUserId[m.author],
        viewsCount: parseViews(m.views),
        likesCount: m.likes,
        favoritesCount: 0,
        modelUrl: m.viewerUrl ?? null,
        viewerType: hasViewer ? ViewerType.sketchfab : ViewerType.none,
        allowIframe: true,
        status: ModelStatus.published,
        visibility: ModelVisibility.public,
        createdAt: parseRelativeTime(m.time, now),
      },
    });
  }

  // 4. 导入站点配置占位（Footer 联系方式等，真实值待业务方提供）
  for (const s of siteConfigs) {
    await prisma.siteConfig.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }

  // 5. 重置自增序列：上面用固定主键 upsert 不会推进 Postgres identity 序列，
  //    否则后续 create（如用户注册、发布模型）会从 id=1 开始撞主键（P2002）。
  //    将 users / categories / models 的序列对齐到当前 MAX(id)。
  for (const table of ['users', 'categories', 'models']) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "${table}"))`,
    );
  }

  // 控制台输出种子结果汇总
  const [categoryCount, userCount, modelCount, siteConfigCount] = await Promise.all([
    prisma.category.count(),
    prisma.user.count(),
    prisma.model.count(),
    prisma.siteConfig.count(),
  ]);
  console.log('[seed] 完成：', {
    categories: categoryCount,
    users: userCount,
    models: modelCount,
    siteConfigs: siteConfigCount,
  });
}

main()
  .catch((e) => {
    console.error('[seed] 失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
