import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteChrome } from "@/components/layout/site-chrome";
import "./globals.css";

/**
 * 根布局：挂载 Vite 对齐的全局样式（globals.css → fonts/tailwind/theme）+ AppProviders + SiteChrome。
 * 用途：全站 dark 基调、Providers、NavBar 路由壳（/auth 不显示 NavBar）。
 */
export const metadata: Metadata = {
  title: "数境空间",
  description: "数境空间官网 — 数字空间资产平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>
        <AppProviders>
          <SiteChrome>{children}</SiteChrome>
        </AppProviders>
      </body>
    </html>
  );
}
