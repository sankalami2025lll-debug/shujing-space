/**
 * 组件：页面占位壳 PagePlaceholder
 * 用途：Next.js 迁移阶段 4A 各路由占位，正式 UI 在后续步骤逐页迁入
 */
interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <main className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-72px)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <p className="text-xs uppercase tracking-widest text-cyan-400/80 mb-3">
          Next.js 迁移 · 步骤 4A
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mb-3">{title}</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          {description ?? "本页为路由占位壳，正式页面内容将在后续迁移步骤中从 Vite 原型迁入。"}
        </p>
      </div>
    </main>
  );
}
