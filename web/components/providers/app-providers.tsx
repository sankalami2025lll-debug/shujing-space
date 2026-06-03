"use client";

/**
 * 模块：全站 Client Providers 组合 AppProviders
 * 页面用途：在 Next.js 根布局挂载 Auth、站点配置、主题与全局 Toaster，供全路由共享
 * 主要功能：ThemeProvider（固定深色）→ AuthProvider → SiteConfigProvider → 页面 + Toaster
 * 对应文档：docs/dev-checkpoint.md（Next.js 迁移步骤 3）
 */
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SiteConfigProvider } from "@/components/providers/site-config-provider";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
      <AuthProvider>
        <SiteConfigProvider>
          {children}
          {/* 全站轻提示出口，与 Vite App.tsx 中 Toaster 配置一致 */}
          <Toaster closeButton position="top-center" visibleToasts={3} />
        </SiteConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
