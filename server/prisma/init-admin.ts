/**
 * 脚本：管理员初始化 init-admin.ts
 *
 * 用途：在不依赖 Admin 前端的情况下，通过环境变量安全地创建 / 提升一个生产管理员账号。
 * 运行：cd server && pnpm admin:init
 *
 * 读取的环境变量（真实值仅在运行时注入，严禁写入仓库 / 文档）：
 *  - ADMIN_EMAIL       必填：管理员登录邮箱（也是唯一标识）
 *  - ADMIN_PASSWORD    必填：管理员明文密码（脚本内 bcrypt 哈希后入库，绝不打印 / 落库明文）
 *  - ADMIN_NICKNAME    可选：管理员昵称，默认取邮箱 @ 前缀
 *  - ADMIN_FORCE_RESET 可选：为 "true" 时，对已存在用户强制重置密码（默认不覆盖已有密码）
 *
 * 行为：
 *  - 邮箱对应用户不存在 → 创建 role=admin、status=active 的管理员。
 *  - 已存在且 role!=admin → 升级为 admin（并确保 status=active 可登录）。
 *  - 已存在 → 默认不覆盖密码；仅 ADMIN_FORCE_RESET=true 时重置密码。
 *
 * 安全红线：
 *  - 密码强度校验：长度 >= 12，且不得为常见弱密码 / 含明显弱口令词。
 *  - 全程不打印明文密码；不在仓库 / 文档保存真实密码。
 *  - seed.ts 的 admin@example.com 仅为本地开发占位，不作为生产登录入口（见 dev-checkpoint）。
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 简单邮箱判定（与 AuthService 一致口径）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 管理员密码最小长度
const MIN_PASSWORD_LENGTH = 12;
// 常见弱密码（精确匹配，小写）
const WEAK_PASSWORD_EXACT = [
  'password',
  'admin',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'admin123',
  'password123',
  '111111',
  '000000',
  'iloveyou',
  'abc123',
];
// 明显弱口令词（包含匹配，小写）：命中即视为弱密码
const WEAK_PASSWORD_KEYWORDS = ['password', 'admin', '123456', 'qwerty'];

// bcrypt 哈希强度（与项目其它处一致）
const BCRYPT_ROUNDS = 10;

/** 读取并校验环境变量，返回标准化输入；不合法直接抛错 */
function readInput(): {
  email: string;
  password: string;
  nickname: string;
  forceReset: boolean;
} {
  const email = (process.env.ADMIN_EMAIL ?? '').trim();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const nicknameRaw = (process.env.ADMIN_NICKNAME ?? '').trim();
  const forceReset = (process.env.ADMIN_FORCE_RESET ?? '').toLowerCase() === 'true';

  // 1) 必填校验
  if (!email || !password) {
    throw new Error(
      '缺少必要环境变量：请同时提供 ADMIN_EMAIL 与 ADMIN_PASSWORD。\n' +
        '示例（PowerShell）：$env:ADMIN_EMAIL="ops@your-domain.com"; $env:ADMIN_PASSWORD="<强密码>"; pnpm admin:init',
    );
  }

  // 2) 邮箱格式
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('ADMIN_EMAIL 格式不正确，请填写有效邮箱。');
  }

  // 3) 密码强度：长度
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD 太短：至少需要 ${MIN_PASSWORD_LENGTH} 位（当前 ${password.length} 位）。`,
    );
  }

  // 4) 密码强度：弱密码黑名单（精确 + 包含）
  const lower = password.toLowerCase();
  if (WEAK_PASSWORD_EXACT.includes(lower)) {
    throw new Error('ADMIN_PASSWORD 属于常见弱密码，请改用更复杂的随机强密码。');
  }
  const hitKeyword = WEAK_PASSWORD_KEYWORDS.find((kw) => lower.includes(kw));
  if (hitKeyword) {
    throw new Error(
      `ADMIN_PASSWORD 含明显弱口令词「${hitKeyword}」，请改用更复杂的随机强密码。`,
    );
  }

  const nickname = nicknameRaw || email.split('@')[0];
  return { email, password, nickname, forceReset };
}

async function main() {
  const { email, password, nickname, forceReset } = readInput();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    // 不存在：创建 admin + active
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created = await prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash,
        role: UserRole.admin,
        status: UserStatus.active,
      },
    });
    console.log('[admin:init] 已创建管理员账号：', {
      id: Number(created.id),
      email: created.email,
      nickname: created.nickname,
      role: created.role,
      status: created.status,
    });
    return;
  }

  // 已存在：按需升级角色 / 重置密码（默认不动密码）
  const data: {
    role?: UserRole;
    status?: UserStatus;
    passwordHash?: string;
  } = {};
  const actions: string[] = [];

  if (existing.role !== UserRole.admin) {
    data.role = UserRole.admin;
    actions.push('角色升级为 admin');
  }
  // 确保管理员可登录（若此前被禁用则恢复 active）
  if (existing.status !== UserStatus.active) {
    data.status = UserStatus.active;
    actions.push('状态恢复为 active');
  }
  if (forceReset) {
    data.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    actions.push('已按 ADMIN_FORCE_RESET 重置密码');
  }

  if (Object.keys(data).length === 0) {
    console.log('[admin:init] 该邮箱已是 admin 且无需变更（默认不覆盖密码）：', {
      id: Number(existing.id),
      email: existing.email,
      role: existing.role,
      status: existing.status,
      tip: '如需重置密码，请设置 ADMIN_FORCE_RESET=true 重新运行。',
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data,
  });
  console.log('[admin:init] 已更新管理员账号：', {
    id: Number(updated.id),
    email: updated.email,
    role: updated.role,
    status: updated.status,
    actions,
  });
}

main()
  .catch((e: unknown) => {
    // 仅输出错误消息，不输出任何密码相关明文
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[admin:init] 失败：', msg);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
