"use client";

/**
 * 组件：AdminGuard
 * 用途：基于现有 AuthProvider 做后台体验守卫。
 * 规则：
 *   1. 未登录：提示“请先登录管理员账号”并跳转 /auth
 *   2. 已登录但非 admin：展示 403 无权限页
 *   3. admin：正常渲染后台壳与子页面
 * 说明：后端 /api/admin/* 仍是最终权限控制，前端仅做体验层守卫。
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

function AdminGuardFallback({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
          <ShieldAlert className="h-7 w-7 text-white/80" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-white/55">{description}</p>
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </div>
  );
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthed, bootstrapping } = useAuth();
  const redirectedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !bootstrapping && !isAuthed && !redirectedRef.current) {
      redirectedRef.current = true;
      toast.error("请先登录管理员账号");
      router.replace("/auth");
    }
  }, [bootstrapping, isAuthed, mounted, router]);

  if (!mounted || bootstrapping) {
    return (
      <AdminGuardFallback
        title="正在校验管理员身份"
        description="后台壳子会在登录态自举完成后自动显示，请稍候。"
      />
    );
  }

  if (!isAuthed) {
    return (
      <AdminGuardFallback
        title="正在跳转登录页"
        description="请使用管理员账号登录后再访问后台。"
      />
    );
  }

  if (user?.role !== "admin") {
    return (
      <AdminGuardFallback
        title="403 无权限访问后台"
        description="当前账号已登录，但不具备管理员角色。后台接口仍由 /api/admin/* 在服务端做最终权限控制。"
        action={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm text-white transition-colors hover:bg-white/[0.05]"
          >
            返回官网首页
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
