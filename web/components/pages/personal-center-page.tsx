"use client";

/**
 * 页面名称：个人中心 PersonalCenter
 * 页面用途：用户管理自己的社区模型、收藏、发布与训练数据服务申请记录
 * 主要功能：四 Tab 懒加载、GET /api/users/me/* 列表与 stats 角标、未登录跳转 /auth
 * 对应文档：页面功能注释文档/09_个人中心_PersonalCenter.md
 * 说明：步骤 8A 迁移至 /models/me；8C「发布新模型」虚线卡接入 UploadModal。
 */
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  FileBox,
  Star,
  Grid3X3,
  ClipboardList,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { UploadModal } from "@/components/models/upload-modal";
import { UploadTaskCard } from "@/components/models/upload-task-card";
import { useUploadTaskManager } from "@/components/providers/upload-task-provider";
import {
  getMyModels,
  getMyPublished,
  getMyFavorites,
  getMyApplications,
  getMyStats,
} from "@/lib/api/users";
import { coverStyleByType, formatRelativeTime } from "@/lib/format";
import { typeTagColor } from "@/lib/community-data";
import { ApiError } from "@/lib/http";
import type { MeStats, MyApplication, MyFavorite, MyModel } from "@/lib/types";
import type { UploadTask } from "@/lib/upload-task/types";

// MODEL_STATUS_META：模型审核状态（后端英文枚举）→ 中文标签 + 角标配色（用于「我的发布/我的模型」）。
const MODEL_STATUS_META: Record<string, { label: string; color: string }> = {
  published: { label: "已发布", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  pending: { label: "审核中", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  rejected: { label: "未通过", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  draft: { label: "草稿", color: "text-gray-400 bg-white/5 border-white/10" },
};

const MODEL_PROCESSING_META: Record<string, { label: string; color: string; action: string }> = {
  uploaded: {
    label: "等待解析",
    color: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    action: "解析中",
  },
  processing: {
    label: "后台解析中",
    color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    action: "解析中",
  },
  ready: {
    label: "可浏览",
    color: "text-green-400 bg-green-500/10 border-green-500/20",
    action: "查看模型",
  },
  failed: {
    label: "解析失败",
    color: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    action: "查看状态",
  },
};

// modelStatusMeta：取模型状态展示信息，未知状态兜底为原文 + 中性配色。
function modelStatusMeta(status: string) {
  return MODEL_STATUS_META[status] ?? { label: status, color: "text-gray-400 bg-white/5 border-white/10" };
}

function modelProcessingMeta(status: string) {
  return (
    MODEL_PROCESSING_META[status] ?? {
      label: status,
      color: "text-gray-400 bg-white/5 border-white/10",
      action: "查看状态",
    }
  );
}

function resolveMyModelBadge(model: MyModel) {
  if (model.status !== "published") {
    return { ...modelStatusMeta(model.status), action: "查看状态" };
  }
  return modelProcessingMeta(model.processingStatus);
}

// APPLICATION_STATUS_META：训练申请状态（后端英文枚举）→ 中文标签 + 角标配色（用于「我的申请」）。
const APPLICATION_STATUS_META: Record<string, { label: string; color: string }> = {
  submitted: { label: "已提交", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  contacted: { label: "已对接", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  evaluating: { label: "评估中", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  quoted: { label: "已报价", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  closed: { label: "已关闭", color: "text-gray-400 bg-white/5 border-white/10" },
};

// applicationStatusMeta：取申请状态展示信息，未知状态兜底为原文 + 中性配色。
function applicationStatusMeta(status: string) {
  return APPLICATION_STATUS_META[status] ?? { label: status, color: "text-gray-400 bg-white/5 border-white/10" };
}

// Async：个人中心各 Tab 列表数据的通用三态容器（加载/错误/数据）。
interface Async<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

const ASYNC_IDLE = { loading: false, error: null, data: null } as const;

type MyModelListItem =
  | { kind: "local-task"; key: string; task: UploadTask }
  | { kind: "persisted-task"; key: string; task: UploadTask }
  | { kind: "server-model"; key: string; model: MyModel };

// CoverPreview：个人中心模型封面预览；有 coverUrl 时优先显示图片，失败或为空则回退渐变占位。
function CoverPreview({
  coverUrl,
  type,
  id,
  className,
  iconClassName,
}: {
  coverUrl: string;
  type: string;
  id: number;
  className: string;
  iconClassName: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = coverStyleByType(type, id);
  const showImage = Boolean(coverUrl) && !imgFailed;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${cover.color} ${className}`}>
      {showImage ? (
        <>
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <Grid3X3 className={`${iconClassName} text-white/20`} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </>
      )}
    </div>
  );
}

// TabState：个人中心单个 Tab 的三态渲染外壳（loading 骨架 / error+重试 / empty 空态 / 正常内容）。
function TabState<T>({
  state,
  emptyText,
  onRetry,
  children,
}: {
  state: Async<T[]>;
  emptyText: string;
  onRetry: () => void;
  children: (data: T[]) => ReactNode;
}) {
  if (state.loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden animate-pulse"
          >
            <div className="h-28 bg-white/5" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-white/5 rounded" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="text-center py-16 text-gray-500">
        <ClipboardList className="w-9 h-9 mx-auto mb-3 opacity-30" />
        <p className="text-[14px]">{state.error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
        >
          重新加载
        </button>
      </div>
    );
  }
  const list = state.data ?? [];
  if (list.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <FileBox className="w-9 h-9 mx-auto mb-3 opacity-30" />
        <p className="text-[14px]">{emptyText}</p>
      </div>
    );
  }
  return <>{children(list)}</>;
}

export default function PersonalCenterPage() {
  const router = useRouter();
  const { user, isAuthed, bootstrapping } = useAuth();
  const { tasks } = useUploadTaskManager();

  // tab：控制当前展示「我的模型 / 我的收藏 / 我的发布 / 我的申请」
  const [tab, setTab] = useState<"models" | "favorites" | "published" | "applications">("models");

  // stats：个人中心统计角标（各 Tab 数量），挂载时拉取一次；失败不阻断页面（角标隐藏）
  const [stats, setStats] = useState<MeStats | null>(null);
  // 四个 Tab 各自的列表三态（按需懒加载，已加载则缓存不重复请求）
  const [models, setModels] = useState<Async<MyModel[]>>(ASYNC_IDLE);
  const [favorites, setFavorites] = useState<Async<MyFavorite[]>>(ASYNC_IDLE);
  const [published, setPublished] = useState<Async<MyModel[]>>(ASYNC_IDLE);
  const [applications, setApplications] = useState<Async<MyApplication[]>>(ASYNC_IDLE);

  // showUpload：发布模型弹窗显隐；关闭时卸载组件以重置表单状态
  const [showUpload, setShowUpload] = useState(false);

  // 未登录访问 /models/me：toast 提示并跳转 /auth（等待 AuthProvider 自举完成后再判定）
  useEffect(() => {
    if (bootstrapping) return;
    if (!isAuthed) {
      toast.error("请先登录后再操作");
      router.replace("/auth");
    }
  }, [bootstrapping, isAuthed, router]);

  // errMsg：统一把 ApiError 转为可展示中文
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "加载失败，请稍后重试。");

  // 各 Tab 加载函数：拉取本人数据（个人中心数据量小，pageSize=50 一次展示，暂不做加载更多）
  const loadModels = useCallback(async () => {
    setModels((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyModels({ status: "all", pageSize: 50 });
      setModels({ loading: false, error: null, data: res.list });
    } catch (e) {
      setModels({ loading: false, error: errMsg(e), data: null });
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavorites((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyFavorites({ pageSize: 50 });
      setFavorites({ loading: false, error: null, data: res.list });
    } catch (e) {
      setFavorites({ loading: false, error: errMsg(e), data: null });
    }
  }, []);

  const loadPublished = useCallback(async () => {
    setPublished((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyPublished({ pageSize: 50 });
      setPublished({ loading: false, error: null, data: res.list });
    } catch (e) {
      setPublished({ loading: false, error: errMsg(e), data: null });
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setApplications((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyApplications({ pageSize: 50 });
      setApplications({ loading: false, error: null, data: res.list });
    } catch (e) {
      setApplications({ loading: false, error: errMsg(e), data: null });
    }
  }, []);

  // 挂载时拉取统计角标（失败静默，不影响列表）；仅登录态下请求
  useEffect(() => {
    if (bootstrapping || !isAuthed) return;
    getMyStats().then(setStats).catch(() => {});
  }, [bootstrapping, isAuthed]);

  // 切换 Tab 时懒加载对应数据：仅当未加载（data 为 null）且不在加载中、且无错误时触发
  useEffect(() => {
    if (bootstrapping || !isAuthed) return;
    if (tab === "models" && models.data === null && !models.loading && !models.error) loadModels();
    if (tab === "favorites" && favorites.data === null && !favorites.loading && !favorites.error)
      loadFavorites();
    if (tab === "published" && published.data === null && !published.loading && !published.error)
      loadPublished();
    if (
      tab === "applications" &&
      applications.data === null &&
      !applications.loading &&
      !applications.error
    )
      loadApplications();
  }, [
    tab,
    models,
    favorites,
    published,
    applications,
    loadModels,
    loadFavorites,
    loadPublished,
    loadApplications,
    bootstrapping,
    isAuthed,
  ]);

  // onView：点击模型卡片时跳转详情页 /models/[id]
  const onView = (id: number) => {
    router.push(`/models/${id}`);
  };

  const handleModelView = useCallback(
    (model: MyModel) => {
      if (model.processingStatus !== "ready") {
        toast.info("模型正在后台解析中，完成后即可浏览");
        return;
      }
      router.push(`/models/${model.id}`);
    },
    [router],
  );

  // handlePublishNew：点击「发布新模型」虚线卡；已登录打开 UploadModal，未登录 toast + /auth
  const handlePublishNew = () => {
    if (!isAuthed) {
      toast.error("请先登录后再操作");
      router.push("/auth");
      return;
    }
    setShowUpload(true);
  };

  // refreshAfterPublish：发布成功后刷新「我的模型 / 我的发布」列表与 stats 角标
  const refreshAfterPublish = useCallback(() => {
    loadModels();
    loadPublished();
    getMyStats().then(setStats).catch(() => {});
  }, [loadModels, loadPublished]);

  // tabs：四个 Tab 定义，角标数量取自 stats（未加载时不显示）
  const tabs = [
    { key: "models" as const, label: "我的模型", icon: <FileBox className="w-4 h-4" />, count: stats?.models },
    { key: "favorites" as const, label: "我的收藏", icon: <Star className="w-4 h-4" />, count: stats?.favorites },
    { key: "published" as const, label: "我的发布", icon: <Grid3X3 className="w-4 h-4" />, count: stats?.published },
    {
      key: "applications" as const,
      label: "我的申请",
      icon: <ClipboardList className="w-4 h-4" />,
      count: stats?.applications,
    },
  ];

  const modelList = models.data ?? [];
  const existingModelIds = new Set(modelList.map((item) => item.id));
  const unresolvedCreatedModelIds = tasks
    .filter(
      (task) =>
        (task.status === "success" || task.status === "processing") &&
        task.createdModelId &&
        !existingModelIds.has(task.createdModelId),
    )
    .map((task) => task.createdModelId as number)
    .sort((a, b) => a - b);
  const unresolvedCreatedModelIdsKey = unresolvedCreatedModelIds.join(",");
  const hasUnresolvedCreatedModels = unresolvedCreatedModelIds.length > 0;

  // 后台任务 createModel 成功后，如果服务端列表还没包含该模型，短轮询刷新一次个人中心数据，直到可去重。
  useEffect(() => {
    if (bootstrapping || !isAuthed) return;
    if (tab !== "models") return;
    if (!hasUnresolvedCreatedModels) return;

    const refresh = () => {
      loadModels();
      loadPublished();
      getMyStats().then(setStats).catch(() => {});
    };

    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [
    unresolvedCreatedModelIdsKey,
    hasUnresolvedCreatedModels,
    tab,
    bootstrapping,
    isAuthed,
    loadModels,
    loadPublished,
  ]);

  // 自举中或未登录：展示 loading，避免未授权内容闪现
  if (bootstrapping || !isAuthed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="pt-16 flex flex-col items-center justify-center gap-3 py-32 text-gray-500">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-[14px]">{bootstrapping ? "正在加载…" : "正在跳转登录页…"}</p>
        </div>
      </div>
    );
  }

  const visibleTasks = tasks.filter(
    (task) => task.createdModelId == null,
  );
  const modelItems: MyModelListItem[] = [
    ...visibleTasks.map((task) => ({
      kind: task.kind === "local" ? ("local-task" as const) : ("persisted-task" as const),
      key: `${task.kind}-task-${task.id}`,
      task,
    })),
    ...modelList.map((model) => ({
      kind: "server-model" as const,
      key: `model-${model.id}`,
      model,
    })),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <div className="pt-16">
        <div className="max-w-[960px] mx-auto px-5 md:px-6 py-10">
          <button
            type="button"
            onClick={() => router.push("/models")}
            className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            返回社区
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-7 h-7 text-gray-400" />
            </div>
            <div>
              <p className="text-[18px] font-medium">{user?.nickname ?? "我的个人中心"}</p>
              <p className="text-[13px] text-gray-500">管理你的模型、收藏与申请记录</p>
            </div>
          </div>

          <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all flex-shrink-0 ${
                  tab === t.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {t.icon}
                {t.label}
                {typeof t.count === "number" && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/10 text-[11px] text-gray-300">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "models" && (
            <>
              {models.loading && modelItems.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden animate-pulse"
                    >
                      <div className="h-28 bg-white/5" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-white/5 rounded" />
                        <div className="h-3 bg-white/5 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {models.error && modelItems.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <ClipboardList className="w-9 h-9 mx-auto mb-3 opacity-30" />
                  <p className="text-[14px]">{models.error}</p>
                  <button
                    type="button"
                    onClick={loadModels}
                    className="mt-4 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
                  >
                    重新加载
                  </button>
                </div>
              )}

              {modelItems.length > 0 && (
                <div
                  data-testid="personal-center-models-grid"
                  className="grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {modelItems.map((item) => {
                    if (item.kind === "local-task" || item.kind === "persisted-task") {
                      return (
                        <div
                          key={item.key}
                          data-testid={
                            item.kind === "local-task"
                              ? "personal-center-local-task-item"
                              : "personal-center-persisted-task-item"
                          }
                          className="w-full self-start"
                        >
                          <UploadTaskCard task={item.task} />
                        </div>
                      );
                    }

                    const m = item.model;
                    const meta = resolveMyModelBadge(m);
                    return (
                      <div
                        key={item.key}
                        data-testid="personal-center-server-model-card"
                        className="relative w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
                      >
                        <CoverPreview
                          coverUrl={m.coverUrl}
                          type={m.type}
                          id={m.id}
                          className="h-28"
                          iconClassName="w-6 h-6"
                        />
                        <div className="p-3">
                          <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <span className="text-[11px] text-gray-500">{m.type}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] border ${meta.color}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleModelView(m)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200 transition-all hover:bg-white/8 hover:border-white/20"
                          >
                            {meta.action}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* 发布新模型：点击打开 UploadModal（8C） */}
                  <button
                    type="button"
                    onClick={handlePublishNew}
                    className="border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center h-40 cursor-pointer hover:border-white/20 transition-all w-full"
                  >
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-[13px] text-gray-500">发布新模型</p>
                    </div>
                  </button>
                </div>
              )}

              {!models.loading && !models.error && modelItems.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <FileBox className="w-9 h-9 mx-auto mb-3 opacity-30" />
                  <p className="text-[14px]">你还没有发布过模型</p>
                </div>
              )}
            </>
          )}

          {tab === "favorites" && (
            <TabState state={favorites} emptyText="你还没有收藏任何模型" onRetry={loadFavorites}>
              {(list) => (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((m) => {
                    if (!m.isAvailable) {
                      return (
                        <div
                          key={m.id}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden opacity-50 cursor-not-allowed"
                        >
                          <CoverPreview
                            coverUrl={m.coverUrl}
                            type={m.type}
                            id={m.id}
                            className="h-28"
                            iconClassName="w-6 h-6"
                          />
                          <div className="p-3">
                            <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                            <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] border text-gray-400 bg-white/5 border-white/10">
                              已下架
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onView(m.id)}
                        className="text-left w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
                      >
                        <CoverPreview
                          coverUrl={m.coverUrl}
                          type={m.type}
                          id={m.id}
                          className="h-28"
                          iconClassName="w-6 h-6"
                        />
                        <div className="p-3">
                          <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                          <span
                            className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[m.type] || "bg-white/10 text-white/60 border-white/10"}`}
                          >
                            {m.type}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </TabState>
          )}

          {tab === "published" && (
            <TabState state={published} emptyText="你还没有已发布的模型" onRetry={loadPublished}>
              {(list) => (
                <div className="space-y-3">
                  {list.map((m) => {
                    const meta = resolveMyModelBadge(m);
                    return (
                      <div
                        key={m.id}
                        className="w-full text-left flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <CoverPreview
                            coverUrl={m.coverUrl}
                            type={m.type}
                            id={m.id}
                            className="w-20 h-14 rounded-lg flex-shrink-0"
                            iconClassName="w-5 h-5"
                          />
                          <p className="text-[14px] line-clamp-1 min-w-0">{m.title}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-[12px] border flex-shrink-0 ml-3 ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleModelView(m)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200 transition-all hover:bg-white/8 hover:border-white/20"
                        >
                          {meta.action}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabState>
          )}

          {tab === "applications" && (
            <TabState
              state={applications}
              emptyText="你还没有提交训练数据服务申请"
              onRetry={loadApplications}
            >
              {(list) => (
                <div className="space-y-3">
                  {list.map((a) => {
                    const meta = applicationStatusMeta(a.status);
                    return (
                      <div
                        key={a.id}
                        className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium line-clamp-1">
                              {a.robotType} — 训练数据服务申请
                            </p>
                            <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">
                              {a.sceneDesc}
                            </p>
                            <p className="text-[12px] text-gray-600 mt-1">
                              {formatRelativeTime(a.createdAt)}提交
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[12px] border flex-shrink-0 ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabState>
          )}
        </div>
      </div>

      {/* 发布模型弹窗：showUpload 为真时挂载，关闭时卸载以重置表单 */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onPublished={refreshAfterPublish}
        />
      )}
    </div>
  );
}
