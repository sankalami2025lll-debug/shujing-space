"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "rgba(9, 9, 11, 0.88)",
          "--normal-text": "rgba(255, 255, 255, 0.96)",
          "--normal-border": "rgba(255, 255, 255, 0.12)",
        } as CSSProperties
      }
      toastOptions={{
        duration: 3200,
        classNames: {
          toast:
            "group toast-card rounded-2xl border border-white/10 bg-black/70 text-white shadow-[0_16px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl",
          title: "text-[14px] font-medium tracking-[0.01em] text-white",
          description: "text-[13px] leading-5 text-white/62",
          actionButton:
            "border border-white/12 bg-white text-black hover:bg-white/92 transition-colors",
          cancelButton:
            "border border-white/12 bg-white/6 text-white hover:bg-white/10 transition-colors",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
