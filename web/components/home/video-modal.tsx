"use client";

/**
 * 组件名称：VideoModal
 * 组件用途：首页业务平台 / 业务场景说明弹窗，模拟视频播放与进度条
 * 主要功能：遮罩关闭、Esc 关闭、播放/暂停、具身智能业务跳转联系页
 * 对应文档：页面功能注释文档/02_首页_Home.md
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Play, Pause } from "lucide-react";
import type { ModalItem } from "@/lib/home-content";

interface VideoModalProps {
  item: ModalItem;
  onClose: () => void;
}

export function VideoModal({ item, onClose }: VideoModalProps) {
  const router = useRouter();
  // playing：是否处于模拟播放中；progress：模拟进度条百分比 0–100
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // handleClose：关闭弹窗并重置播放状态（遮罩 / 关闭钮 / Esc 共用）
  const handleClose = useCallback(() => {
    setPlaying(false);
    onClose();
  }, [onClose]);

  // Esc 关闭弹窗
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // 模拟播放进度：playing 为真时定时推进 progress
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setPlaying(false);
          return 0;
        }
        return p + 0.5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  // handleNavigateContact：具身智能弹窗底部「申请训练数据服务」→ 联系页
  const handleNavigateContact = () => {
    handleClose();
    router.push("/contact");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-[960px] bg-[#0f0f0f] border border-white/10 rounded-t-3xl sm:rounded-[24px] overflow-hidden flex flex-col sm:flex-row max-h-[90vh] sm:max-h-[680px]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(6,182,212,0.08), 0 32px 80px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
          aria-label="关闭"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* 左侧：模拟视频区域（65%） */}
        <div className="w-full sm:w-[65%] flex-shrink-0 flex flex-col">
          <div
            className={`relative flex-1 bg-gradient-to-br ${item.gradientFrom} ${item.gradientTo} overflow-hidden`}
            style={{ minHeight: 220, aspectRatio: "16/9" }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-cyan-500/30" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-8 left-3 w-4 h-4 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-8 right-3 w-4 h-4 border-b border-r border-cyan-500/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white/30">
                  {item.icon}
                </div>
                {!playing && (
                  <p className="text-white/30 text-[13px]">{item.videoTitle}</p>
                )}
                {playing && (
                  <p className="text-cyan-400/60 text-[13px]">正在播放...</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div
                className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 ${playing ? "bg-white/5 border-white/15 opacity-0 group-hover:opacity-100" : "bg-white/10 border-white/20 hover:bg-white/15 hover:border-cyan-500/30"}`}
              >
                {playing ? (
                  <Pause className="w-5 h-5 text-white/70" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </div>
            </button>
          </div>

          <div className="h-10 bg-[#0a0a0a] border-t border-white/5 flex items-center px-4 gap-3">
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              {playing ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-600 flex-shrink-0">
              {Math.floor((progress * 1.8) / 60)
                .toString()
                .padStart(2, "0")}
              :
              {Math.floor((progress * 1.8) % 60)
                .toString()
                .padStart(2, "0")}{" "}
              / 03:00
            </span>
          </div>
        </div>

        {/* 右侧：说明面板（35%） */}
        <div className="w-full sm:w-[35%] flex flex-col justify-center p-6 md:p-10 overflow-y-auto border-t sm:border-t-0 sm:border-l border-white/[0.06]">
          <div className="space-y-5">
            <div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px]">
                {item.category}
              </span>
            </div>
            <h2 className="text-[22px] md:text-[24px] font-semibold leading-tight">
              {item.title}
            </h2>
            <p className="text-[13px] md:text-[14px] text-gray-400 leading-relaxed">
              {item.desc}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[12px] text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 弹窗底部引导按钮：具身智能业务显示「申请训练数据服务」；首页业务平台/业务场景弹窗不显示「浏览模型」 */}
          {(item.isEmbodied ||
            (item.category !== "业务平台" &&
              item.category !== "业务场景")) && (
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              {item.isEmbodied ? (
                <button
                  type="button"
                  onClick={handleNavigateContact}
                  className="w-full py-2.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[14px] hover:bg-violet-500/25 transition-all"
                >
                  申请训练数据服务
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push("/models");
                  }}
                  className="w-full py-2.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-[14px] hover:bg-cyan-500/25 transition-all"
                >
                  浏览模型
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
