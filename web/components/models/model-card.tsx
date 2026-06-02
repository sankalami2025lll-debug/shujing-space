"use client";

/**
 * 组件名称：ModelCard
 * 组件用途：模型库列表单个模型卡片（读接口展示 + 点赞/收藏写接口）
 * 对应文档：页面功能注释文档/05_模型库列表页_ModelLibrary.md
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { Grid3X3, Eye, Heart, Bookmark, Share2, User } from "lucide-react";
import { toast } from "sonner";
import {
  likeModel,
  unlikeModel,
  favoriteModel,
  unfavoriteModel,
} from "@/lib/api/models";
import { typeTagColor } from "@/lib/community-data";
import { coverStyleByType, formatViews, formatRelativeTime } from "@/lib/format";
import { ApiError } from "@/lib/http";
import type { ModelListItem } from "@/lib/types";

function toTagArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

interface ModelCardProps {
  model: ModelListItem;
  isAuthed: boolean;
  onRequireAuth: () => void;
}

export function ModelCard({ model, isAuthed, onRequireAuth }: ModelCardProps) {
  // liked / saved：点赞/收藏按钮状态，用后端 isLiked/isFavorited 初始化（游客无该字段则 false）
  const [liked, setLiked] = useState(model.isLiked ?? false);
  const [saved, setSaved] = useState(model.isFavorited ?? false);
  // likes：点赞计数本地态，点赞/取消后用接口返回值校正
  const [likes, setLikes] = useState(model.likesCount);
  // likePending / savePending：请求进行中标志，防止连点
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    setLiked(model.isLiked ?? false);
  }, [model.isLiked]);
  useEffect(() => {
    setSaved(model.isFavorited ?? false);
  }, [model.isFavorited]);
  useEffect(() => {
    setLikes(model.likesCount);
  }, [model.likesCount]);

  const handleLike = async () => {
    if (!isAuthed) {
      onRequireAuth();
      return;
    }
    if (likePending) return;
    const next = !liked;
    setLikePending(true);
    setLiked(next);
    setLikes((c) => c + (next ? 1 : -1));
    try {
      const res = next ? await likeModel(model.id) : await unlikeModel(model.id);
      setLiked(res.liked);
      setLikes(res.likesCount);
    } catch (e) {
      setLiked(!next);
      setLikes((c) => c + (next ? -1 : 1));
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setLikePending(false);
    }
  };

  const handleSave = async () => {
    if (!isAuthed) {
      onRequireAuth();
      return;
    }
    if (savePending) return;
    const next = !saved;
    setSavePending(true);
    setSaved(next);
    try {
      const res = next
        ? await favoriteModel(model.id)
        : await unfavoriteModel(model.id);
      setSaved(res.favorited);
    } catch (e) {
      setSaved(!next);
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setSavePending(false);
    }
  };

  const isRobot = model.type === "具身智能机器人训练场景";
  const cover = coverStyleByType(model.type, model.id);
  const tags = toTagArray(model.tags);

  return (
    <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col">
      <div
        className={`relative h-44 bg-gradient-to-br ${cover.color} overflow-hidden flex-shrink-0`}
      >
        {model.coverUrl ? (
          <>
            <img
              src={model.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                <Grid3X3 className="w-8 h-8 text-white/20" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`px-2 py-1 rounded-full text-[11px] border ${typeTagColor[model.type] || "bg-white/10 text-white/60 border-white/10"}`}
          >
            {model.type}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="text-[15px] font-medium leading-tight line-clamp-2">
          {model.title}
        </h3>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-auto pt-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-gray-400" />
          </div>
          <span className="text-[12px] text-gray-400 flex-1 truncate">{model.author}</span>
          <span className="text-[11px] text-gray-500">
            {formatRelativeTime(model.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-gray-500">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {formatViews(model.viewsCount)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {likes}
          </span>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <Link
            href={`/models/${model.id}`}
            className="w-full py-2 rounded-xl bg-white/8 border border-white/10 text-[13px] hover:bg-white/12 hover:border-white/20 transition-all text-center"
          >
            浏览模型
          </Link>
          {isRobot && (
            <Link
              href={`/models/${model.id}`}
              className="w-full py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[13px] hover:bg-violet-500/20 transition-all text-center"
            >
              申请训练数据服务
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4 pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={handleLike}
            disabled={likePending}
            className={`flex items-center gap-1 text-[12px] transition-colors disabled:opacity-60 ${liked ? "text-red-400" : "text-gray-500 hover:text-gray-300"}`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-red-400" : ""}`} />
            点赞
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={savePending}
            className={`flex items-center gap-1 text-[12px] transition-colors disabled:opacity-60 ${saved ? "text-yellow-400" : "text-gray-500 hover:text-gray-300"}`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-yellow-400" : ""}`} />
            收藏
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            分享
          </button>
        </div>
      </div>
    </div>
  );
}
