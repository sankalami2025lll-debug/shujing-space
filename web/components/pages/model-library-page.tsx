"use client";

/**
 * 页面名称：模型库列表页 ModelLibrary（列表视图）
 * 页面用途：模型浏览、搜索、分类筛选、排序与分页加载
 * 主要功能：GET /api/categories、GET /api/models、加载更多、Footer
 * 对应文档：页面功能注释文档/05_模型库列表页_ModelLibrary.md
 * 说明：步骤 7A 列表 + 7C 卡片点赞/收藏 + 8A 个人中心入口 + 8B UploadModal 发布模型；TrainingModal 在详情页。
 *       全站 NavBar 由 SiteChrome 挂载。
 */
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { useSiteConfig } from "@/components/providers/site-config-provider";
import { ModelCard } from "@/components/models/model-card";
import { UploadModal } from "@/components/models/upload-modal";
import { getCategories } from "@/lib/api/categories";
import { getModels } from "@/lib/api/models";
import {
  MODEL_TYPES,
  SORT_OPTIONS,
  SORT_MAP,
  PAGE_SIZE,
} from "@/lib/model-library-constants";
import { ApiError } from "@/lib/http";
import type { ModelListItem } from "@/lib/types";

export default function ModelLibraryPage() {
  const router = useRouter();
  const { isAuthed } = useAuth();
  const { config } = useSiteConfig();

  // requireAuth：未登录时提示并跳转登录页（供个人中心/发布/点赞收藏占位）
  const requireAuth = useCallback(() => {
    toast.error("请先登录后再操作");
    router.push("/auth");
  }, [router]);

  // activeType：当前分类筛选（「全部模型」不传 type）
  const [activeType, setActiveType] = useState<string>("全部模型");
  const [activeSort, setActiveSort] = useState<string>("最新发布");
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");

  // categoryNames：分类按钮文案；默认 MODEL_TYPES，挂载后用后端覆盖
  const [categoryNames, setCategoryNames] = useState<string[]>([...MODEL_TYPES]);

  const [list, setList] = useState<ModelListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // showUpload：发布模型弹窗显隐；关闭时卸载组件以重置表单状态
  const [showUpload, setShowUpload] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listReqIdRef = useRef(0);

  // loadModels：拉取列表；append=true 为加载更多
  const loadModels = useCallback(
    async (targetPage: number, append: boolean) => {
      const reqId = ++listReqIdRef.current;
      if (append) setLoadingMore(true);
      else {
        setListLoading(true);
        setListError(null);
      }
      try {
        const res = await getModels({
          type: activeType === "全部模型" ? undefined : activeType,
          keyword: keyword || undefined,
          sort: SORT_MAP[activeSort] ?? "latest",
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (reqId !== listReqIdRef.current) return;
        setTotal(res.total);
        setPage(res.page);
        setList((prev) => (append ? [...prev, ...res.list] : res.list));
      } catch (e) {
        if (reqId !== listReqIdRef.current) return;
        const msg =
          e instanceof ApiError ? e.message : "模型列表加载失败，请稍后重试。";
        if (!append) {
          setList([]);
          setTotal(0);
        }
        setListError(msg);
        toast.error(msg);
      } finally {
        if (reqId === listReqIdRef.current) {
          setListLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeType, keyword, activeSort],
  );

  useEffect(() => {
    loadModels(1, false);
  }, [loadModels]);

  useEffect(() => {
    getCategories()
      .then((cats) => {
        if (cats?.length) {
          setCategoryNames(["全部模型", ...cats.map((c) => c.name)]);
        }
      })
      .catch(() => {
        // 分类失败：保留 MODEL_TYPES
      });
  }, []);

  const handleSearchClick = () => {
    searchInputRef.current?.blur();
    setPage(1);
    setKeyword(searchInput.trim());
  };

  const handleCategoryClick = (type: string) => {
    setPage(1);
    setActiveType(type);
    if (type === "全部模型") {
      setSearchInput("");
      setKeyword("");
    }
  };

  const canLoadMore = list.length < total;
  const handleLoadMore = () => {
    if (canLoadMore && !loadingMore && !listLoading) {
      loadModels(page + 1, true);
    }
  };

  // handlePersonalCenter：已登录跳转 /models/me；未登录 toast + 跳转 /auth
  const handlePersonalCenter = () => {
    if (!isAuthed) {
      requireAuth();
      return;
    }
    router.push("/models/me");
  };

  const handlePublish = () => {
    if (!isAuthed) {
      requireAuth();
      return;
    }
    setShowUpload(true);
  };

  const hasActiveFilters =
    activeType !== "全部模型" || keyword.length > 0 || activeSort !== "最新发布";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <div className="pt-16">
        <div className="bg-[#0d0d0d] border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-8 md:py-10">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-[26px] md:text-[32px] font-bold">模型社区</h1>
                <p className="text-[14px] md:text-[15px] text-gray-400 mt-1">
                  发现、浏览并发布真实三维空间模型
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handlePersonalCenter}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[13px] text-gray-300 hover:bg-white/8 transition-all"
                >
                  <User className="w-3.5 h-3.5" />
                  个人中心
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="px-5 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all"
                >
                  发布模型
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchClick();
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-24 py-3 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                placeholder="搜索模型名称或作者"
              />
              <button
                type="button"
                onClick={handleSearchClick}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-white/10 text-[13px] text-gray-300 hover:bg-white/15 transition-all"
              >
                搜索
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {categoryNames.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleCategoryClick(t)}
                  className={`px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap flex-shrink-0 transition-all border ${
                    activeType === t
                      ? "bg-white text-black border-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border-b border-white/[0.06] sticky top-16 md:top-[72px] z-30">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-3">
            <div className="flex items-center gap-2 md:gap-6 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[12px] text-gray-500 hidden md:block">排序：</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSort(s)}
                      className={`px-2.5 py-1 rounded-lg text-[12px] whitespace-nowrap transition-all ${
                        activeSort === s
                          ? "bg-white/10 text-white"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-medium">
              {activeType === "全部模型" ? "全部模型" : activeType}
            </h2>
            <span className="text-[13px] text-gray-500">共 {total} 个模型</span>
          </div>

          {listLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="h-44 bg-white/5" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-white/5 rounded" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                    <div className="h-8 bg-white/5 rounded-xl mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listError ? (
            <div className="text-center py-20 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-[15px]">{listError}</p>
              <button
                type="button"
                onClick={() => loadModels(1, false)}
                className="mt-4 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
              >
                重新加载
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-[15px]">
                {hasActiveFilters ? "未找到相关模型" : "暂无模型，欢迎上传发布第一个模型"}
              </p>
              <p className="text-[13px] mt-1">
                {hasActiveFilters
                  ? "请尝试其他关键词、分类或排序条件"
                  : "当前列表仅展示 /api/models 返回的真实模型数据。"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {list.map((m) => (
                <ModelCard
                  key={m.id}
                  model={m}
                  isAuthed={isAuthed}
                  onRequireAuth={requireAuth}
                />
              ))}
            </div>
          )}

          {!listLoading && !listError && list.length > 0 && (
            <div className="text-center mt-10">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={!canLoadMore || loadingMore}
                className={`px-8 py-3 rounded-full border text-[14px] transition-all ${
                  canLoadMore && !loadingMore
                    ? "bg-white/8 border-white/10 text-gray-200 hover:bg-white/12 hover:border-white/20"
                    : "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                {loadingMore
                  ? "加载中…"
                  : canLoadMore
                    ? "加载更多"
                    : "已加载全部模型"}
              </button>
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 bg-black py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="/logo.png"
                    alt="数境空间"
                    className="h-6 w-auto object-contain"
                    style={{ mixBlendMode: "screen" }}
                  />
                  <span className="text-[16px] font-medium">数境空间</span>
                </div>
                <p className="text-[13px] text-gray-500">{config.companyName}</p>
              </div>
              <div>
                <h4 className="text-[14px] font-semibold mb-3">联系方式</h4>
                <div className="space-y-1.5 text-[13px] text-gray-500">
                  <p>电话：{config.phone}</p>
                  <p>邮箱：{config.email}</p>
                  <p>地址：{config.address}</p>
                </div>
              </div>
              <div>
                <h4 className="text-[14px] font-semibold mb-3">导航</h4>
                <div className="space-y-1.5 text-[13px]">
                  <Link
                    href="/"
                    className="block text-gray-500 hover:text-white transition-colors"
                  >
                    首页
                  </Link>
                  <Link
                    href="/community"
                    className="block text-gray-500 hover:text-white transition-colors"
                  >
                    模型社区
                  </Link>
                  <Link
                    href="/about"
                    className="block text-gray-500 hover:text-white transition-colors"
                  >
                    关于我们
                  </Link>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/10 text-center">
              <p className="text-[12px] text-gray-600">{config.footerText}</p>
              {config.icp && (
                <p className="mt-2 text-[12px] text-gray-600">{config.icp}</p>
              )}
            </div>
          </div>
        </footer>
      </div>

      {/* 发布模型弹窗：showUpload 为真时挂载，关闭时卸载以重置表单 */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onPublished={() => loadModels(1, false)}
        />
      )}
    </div>
  );
}
