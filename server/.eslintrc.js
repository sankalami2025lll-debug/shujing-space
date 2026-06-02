/**
 * 配置名称：数境空间后端 ESLint 配置（温和版）
 * 用途：让 `pnpm lint` 可执行，仅做基础静态检查，不引入 type-checked 重规则。
 * 说明：
 *  - 第一阶段目标是「lint 可执行」，不为格式/历史小问题大改业务代码。
 *  - 未启用 plugin:@typescript-eslint/recommended-type-checked，避免对历史代码产生大面积告警。
 *  - 关闭若干对当前 NestJS/装饰器风格不友好的规则，保持改动最小。
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  // 忽略构建产物、依赖与配置文件本身
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules', 'prisma/seed.ts'],
  rules: {
    // NestJS 中大量使用 any / 装饰器，第一阶段先放宽，避免大面积历史改动
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // 未使用变量降级为告警，并允许下划线前缀忽略
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
};
