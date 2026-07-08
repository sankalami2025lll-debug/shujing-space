"use client";

/**
 * 组件名称：ModelAnnotationLayer
 * 组件用途：在 LCC Viewer 之上叠加 DOM 标注层（标注点 + 标题胶囊 + 小箭头 + 展开内容框 + 选点）。
 * 主要功能：
 *   1. rAF 节流（~33ms）将每个标注的 anchorPosition 通过 viewerHandle.projectPoint 重投影到屏幕。
 *   2. 取消长引线：标题胶囊紧贴标注点上方，底部带小三角箭头指向标注点。
 *   3. 标题 placement 固定 top：标题始终在标注点上方，上方空间不足时仅 Y clamp 到顶部安全边距，
 *      不翻转到标注点下方；水平居中于标注点，左右 clamp 到视口留白内；标注点跟随真实投影不吸边。
 *   4. 展开内容框：以标注点为中心、固定屏幕尺寸（不随模型缩放放大）、始终在标注点上方，
 *      底部小箭头指向标注点；锚点不可见时自动收起为标题态。
 *   5. owner 管理模式下：显示「新增标注」入口、选点十字光标、点击点/标题进入编辑。
 *   6. 纯净模式由外层控制 visible=false 直接不渲染。
 * 对应文档：模型空间热点标注 V1。
 * 红线：标注层为 DOM overlay，不做成 3D 几何体；复用 pickPoint/projectPoint/getCurrentView/applyView，不新增 handle。
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Crosshair, Plus, X } from "lucide-react";
import type { ModelViewerHandle, ModelViewerPoint } from "@/components/models/viewers/types";
import type { ModelAnnotation, ModelLaunchView } from "@/lib/types";
import {
  ANNOTATION_VISUAL,
  CARD_ESTIMATED_HEIGHT,
  VIEWPORT_MARGIN_X,
  decideInitialPlacement,
  estimateTitleWidth,
  resolveCardBox,
  resolveTitleBox,
  type AnnotationPlacement,
  type AnnotationScreenPoint,
} from "./model-annotation-types";

interface ProjectedAnnotation {
  id: number;
  anchor: AnnotationScreenPoint;
  title: AnnotationScreenPoint;
  titleWidth: number;
  placement: AnnotationPlacement;
}

interface ModelAnnotationLayerProps {
  annotations: ModelAnnotation[];
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewerHandleRef: React.MutableRefObject<ModelViewerHandle | null>;
  /** 游客点击标题：外层负责 applyView + 展开内容框 */
  onSelectTitle: (annotation: ModelAnnotation) => void;
  /** 收起已展开内容框 */
  onCollapse: () => void;
  expandedId: number | null;
  /** 正在飞行到该标注视角的 id；用于在飞行期间高亮该标注标题，提示用户镜头正在移动 */
  flyingId: number | null;
  /** 是否处于飞行动画中：飞行期间挂起标注 overlay（隐藏标题/标注点/内容框）并暂停 reproject，
   *  避免相机快速插值时 projectPoint 投影乱跳；picking 选点遮罩不受影响 */
  isFlying: boolean;
  /** owner 管理模式 */
  canManage: boolean;
  manageMode: boolean;
  onAddAnnotation: () => void;
  onEditAnnotation: (annotation: ModelAnnotation) => void;
  /** 选点模式 */
  picking: boolean;
  onPick: (clientX: number, clientY: number, nativeEvent: MouseEvent | PointerEvent) => void;
  onCancelPick: () => void;
}

const REPROJECT_INTERVAL_MS = 33;

function toPoint(pos: [number, number, number]): ModelViewerPoint {
  return { x: pos[0], y: pos[1], z: pos[2], coordinateSpace: "render" };
}

export function ModelAnnotationLayer({
  annotations,
  visible,
  containerRef,
  viewerHandleRef,
  onSelectTitle,
  onCollapse,
  expandedId,
  flyingId,
  isFlying,
  canManage,
  manageMode,
  onAddAnnotation,
  onEditAnnotation,
  picking,
  onPick,
  onCancelPick,
}: ModelAnnotationLayerProps) {
  const [projected, setProjected] = useState<ProjectedAnnotation[]>([]);
  // 内容框已测量高度缓存（每 annotationId 一份）：由 AnnotationCard 首次挂载后通过 useLayoutEffect 测量回填，
  // 用于在标注点上方定位（cardY = anchor.y - cardHeight - CARD_GAP）。不每帧 getBoundingClientRect。
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  const rafRef = useRef<number>(0);
  const lastRunAtRef = useRef(0);
  const annotationsRef = useRef<ModelAnnotation[]>(annotations);
  // 飞行挂起状态 ref：reproject 在 rAF 闭包里读取，避免 isFlying 变化重建 useCallback。
  // 飞行期间挂起投影，避免相机快速插值时标注点屏幕投影乱跳。
  const suspendProjectionRef = useRef(false);
  useEffect(() => {
    // picking 时不挂起：选点遮罩需要正常交互
    const suspend = isFlying && !picking;
    suspendProjectionRef.current = suspend;
    if (suspend) {
      // 进入飞行：立即清空已投影坐标，避免飞行首帧渲染出过期位置
      setProjected([]);
    }
  }, [isFlying, picking]);
  // placement / titleWidth 缓存：每个 annotationId 一份，相机移动时不重算，避免标题上下跳动
  const placementRef = useRef<Map<number, AnnotationPlacement>>(new Map());
  const titleWidthRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  // rAF 重投影：将世界锚点投影到屏幕，并按缓存的 placement 计算标题胶囊位置（取消长引线）
  const reproject = useCallback(() => {
    // 飞行动画期间挂起投影：相机快速插值时 projectPoint 会乱跳，飞行结束后由 isFlying=false 重新启用
    if (suspendProjectionRef.current) {
      return;
    }
    const container = containerRef.current;
    const handle = viewerHandleRef.current;
    if (!container || !handle?.projectPoint) {
      setProjected([]);
      return;
    }
    const rect = container.getBoundingClientRect();
    const list = annotationsRef.current;
    const width = rect.width;
    const height = rect.height;

    // 清理已删除标注的缓存，避免无限增长；保留现有标注的 placement 以维持稳定
    const currentIds = new Set(list.map((a) => a.id));
    for (const id of [...placementRef.current.keys()]) {
      if (!currentIds.has(id)) {
        placementRef.current.delete(id);
        titleWidthRef.current.delete(id);
      }
    }

    const titleHeight = ANNOTATION_VISUAL.titleHeight;
    const next: ProjectedAnnotation[] = [];
    for (const a of list) {
      const projectedPoint = handle.projectPoint(toPoint(a.anchorPosition));
      if (!projectedPoint) continue;
      const anchor: AnnotationScreenPoint = {
        x: projectedPoint.clientX - rect.left,
        y: projectedPoint.clientY - rect.top,
        visible: projectedPoint.visible,
      };
      // 不可见 / 在相机背后 / 超出合理屏幕范围太多 → 隐藏该标注，不强行吸到屏幕边缘
      if (
        !anchor.visible ||
        anchor.x < -50 || anchor.x > width + 50 ||
        anchor.y < -50 || anchor.y > height + 50
      ) {
        continue;
      }

      // 标题宽度：使用稳定估算值（首次缓存），不每帧 DOM 测量，避免位置抖动
      let titleWidth = titleWidthRef.current.get(a.id);
      if (titleWidth == null) {
        titleWidth = estimateTitleWidth(a.title);
        titleWidthRef.current.set(a.id, titleWidth);
      }

      // 标题 placement 固定 top：标题始终在标注点上方，上方空间不足时仅 Y clamp 到顶部安全边距，
      // 不翻转到标注点下方（产品要求所有文字内容都在标注点上方）。结果缓存，避免每帧重算。
      let placement = placementRef.current.get(a.id);
      if (!placement) {
        placement = decideInitialPlacement();
        placementRef.current.set(a.id, placement);
      }

      const { titleX, titleY } = resolveTitleBox(
        anchor,
        titleWidth,
        titleHeight,
        placement,
        width,
      );

      const title: AnnotationScreenPoint = {
        x: titleX,
        y: titleY,
        visible: true,
      };
      next.push({ id: a.id, anchor, title, titleWidth, placement });
    }
    setProjected((current) => {
      if (current.length === next.length && current.every((c, i) => sameProjected(c, next[i]))) {
        return current;
      }
      return next;
    });
  }, [containerRef, viewerHandleRef]);

  useEffect(() => {
    if (!visible) {
      setProjected([]);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (now - lastRunAtRef.current >= REPROJECT_INTERVAL_MS) {
        lastRunAtRef.current = now;
        reproject();
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [reproject, visible]);

  // Esc 取消选点
  useEffect(() => {
    if (!picking) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancelPick();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [picking, onCancelPick]);

  // 展开内容框自动收起：当展开标注的锚点投影不可见（在相机背后 / 出屏 / 模型被拉远到不可投影）时，
  // 自动收起为标题态，避免内容框失去指向点仍占据画面。仅依赖 projected 变化触发，不额外轮询。
  // 注意：飞行结束后 projected 会先经历一个空数组恢复窗口，此时不能立刻收起 activeAnnotationId，
  // 否则内容框还没等到下一次 reproject 就被关闭，只剩标题胶囊。
  useEffect(() => {
    if (expandedId == null) return;
    if (isFlying) return;
    if (projected.length === 0) return;
    const cur = projected.find((x) => x.id === expandedId);
    if (!cur || !cur.anchor.visible) {
      onCollapse();
    }
  }, [expandedId, projected, isFlying, onCollapse]);

  // 纯净模式隐藏且非选点：整层不渲染。
  // 注意：不能因为 annotations.length===0 就 return null，否则 owner 进入标注管理后
  // 「新增标注」入口和选点遮罩永远无法显示（首次使用时标注列表为空）。
  if (!visible && !picking) return null;
  // 飞行动画期间（非选点）：隐藏标题/标注点/内容框，避免投影乱跳；picking 遮罩与管理入口不受影响。
  const showAnnotationsList = visible && annotations.length > 0 && !(isFlying && !picking);

  const handlePickingClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!picking) return;
    event.preventDefault();
    event.stopPropagation();
    onPick(event.clientX, event.clientY, event.nativeEvent);
  };

  const handlePickingPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!picking) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const layerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 25,
  };

  return (
    <div style={layerStyle} data-annotation-layer="true">
      {/* 选点遮罩：覆盖整个 viewer，捕获点击 */}
      {picking ? (
        <div
          className="absolute inset-0 cursor-crosshair"
          style={{ pointerEvents: "auto", background: "rgba(8,10,14,0.18)" }}
          onClick={handlePickingClick}
          onPointerDown={handlePickingPointerDown}
        >
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-white/15 bg-black/70 px-3 py-1.5 text-[12px] text-white backdrop-blur">
            <Crosshair className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            点击模型表面选择标注点 · Esc 取消
          </div>
        </div>
      ) : null}

      {/* 点 + 标题（取消长引线：标题胶囊紧贴标注点上方/下方，带小三角箭头指向标注点） */}
      {showAnnotationsList
        ? annotations.map((annotation) => {
        const p = projected.find((x) => x.id === annotation.id);
        if (!p || !p.anchor.visible) return null;
        const isExpanded = expandedId === annotation.id;
        const arrowSize = ANNOTATION_VISUAL.arrowSize;
        // 小箭头水平位置：跟随标注点 x（标题可能被 clamp，但箭头始终对准真实标注点）
        const arrowLeft = Math.max(
          ANNOTATION_VISUAL.arrowSize,
          Math.min(p.title.x + p.titleWidth - ANNOTATION_VISUAL.arrowSize, p.anchor.x),
        );
        return (
          <div key={`ann-${annotation.id}`}>
            {/* 锚点：中心 cyan 实心圆 + 外圈描边 + 暗色外描边 */}
            <button
              type="button"
              aria-label={`标注：${annotation.title}`}
              title={annotation.title}
              onClick={(e) => {
                e.stopPropagation();
                if (manageMode) {
                  onEditAnnotation(annotation);
                } else {
                  onSelectTitle(annotation);
                }
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                left: p.anchor.x,
                top: p.anchor.y,
                width: ANNOTATION_VISUAL.pinCenterRadius * 2,
                height: ANNOTATION_VISUAL.pinCenterRadius * 2,
                background: ANNOTATION_VISUAL.cyan,
                borderColor: "rgba(255,255,255,0.9)",
                pointerEvents: "auto",
                boxShadow: ANNOTATION_VISUAL.pinDarkOutline,
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: ANNOTATION_VISUAL.pinOuterRadius * 2,
                  height: ANNOTATION_VISUAL.pinOuterRadius * 2,
                  border: `1.5px solid ${ANNOTATION_VISUAL.cyan}`,
                  opacity: ANNOTATION_VISUAL.pinOuterOpacity,
                }}
              />
            </button>

            {/* 标题胶囊 + 小箭头（展开时不显示，由内容框承担） */}
            {!isExpanded ? (
              <div
                className="absolute"
                style={{
                  left: p.title.x,
                  top: p.title.y,
                  width: p.titleWidth,
                  pointerEvents: "auto",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (manageMode) {
                      onEditAnnotation(annotation);
                    } else {
                      onSelectTitle(annotation);
                    }
                  }}
                  className="flex w-full items-center justify-center whitespace-nowrap rounded-full border backdrop-blur-md"
                  style={{
                    height: ANNOTATION_VISUAL.titleHeight,
                    padding: "0 12px",
                    background: ANNOTATION_VISUAL.bg,
                    // 飞行中：用冰蓝高亮边框提示用户镜头正在移向该标注
                    borderColor:
                      flyingId === annotation.id
                        ? ANNOTATION_VISUAL.cyan
                        : ANNOTATION_VISUAL.border,
                    color: "white",
                    fontSize: ANNOTATION_VISUAL.titleFontSize,
                    boxShadow: ANNOTATION_VISUAL.titleShadow,
                  }}
                >
                  {annotation.title}
                </button>
                {/* 小三角箭头：placement=top 时在标题底部朝下；bottom 时在标题顶部朝上。
                    箭头水平位置对准标注点 x（在标题宽度内 clamp），颜色与标题背景一致 */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: arrowLeft - p.title.x - arrowSize,
                    top:
                      p.placement === "top"
                        ? ANNOTATION_VISUAL.titleHeight
                        : -arrowSize,
                    width: 0,
                    height: 0,
                    borderLeft: `${arrowSize}px solid transparent`,
                    borderRight: `${arrowSize}px solid transparent`,
                    [p.placement === "top" ? "borderTop" : "borderBottom"]: `${arrowSize}px solid ${ANNOTATION_VISUAL.bg}`,
                  }}
                />
              </div>
            ) : null}

            {/* 展开内容框：以标注点为中心、固定屏幕尺寸、始终在标注点上方，
                不随模型缩放放大；箭头在内容框底部指向标注点 */}
            {isExpanded ? (() => {
              const containerWidth =
                containerRef.current?.getBoundingClientRect().width ??
                ANNOTATION_VISUAL.cardWidth;
              const cardWidth = Math.min(
                ANNOTATION_VISUAL.cardWidth,
                containerWidth - VIEWPORT_MARGIN_X * 2,
              );
              const cardHeight = cardHeights[annotation.id] ?? CARD_ESTIMATED_HEIGHT;
              const { cardX, cardY, arrowLeft } = resolveCardBox(
                p.anchor,
                cardWidth,
                cardHeight,
                containerWidth,
              );
              return (
                <AnnotationCard
                  annotation={annotation}
                  left={cardX}
                  top={cardY}
                  width={cardWidth}
                  arrowLeft={arrowLeft}
                  canManage={canManage}
                  onCollapse={onCollapse}
                  onEdit={manageMode ? () => onEditAnnotation(annotation) : undefined}
                  onMeasureHeight={(h) => {
                    if (Math.abs((cardHeights[annotation.id] ?? 0) - h) > 1) {
                      setCardHeights((prev) => ({ ...prev, [annotation.id]: h }));
                    }
                  }}
                />
              );
            })() : null}
          </div>
        );
      })
        : null}

      {/* owner 管理模式：新增标注入口 */}
      {canManage && manageMode && !picking && expandedId === null ? (
        <div
          className="absolute left-1/2 top-4 -translate-x-1/2"
          style={{ pointerEvents: "auto" }}
        >
          <button
            type="button"
            onClick={onAddAnnotation}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-[12px] text-cyan-100 backdrop-blur hover:bg-cyan-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            新增标注
          </button>
        </div>
      ) : null}
    </div>
  );
}

function sameProjected(a: ProjectedAnnotation, b: ProjectedAnnotation): boolean {
  return (
    a.id === b.id &&
    Math.abs(a.anchor.x - b.anchor.x) < 0.5 &&
    Math.abs(a.anchor.y - b.anchor.y) < 0.5 &&
    a.anchor.visible === b.anchor.visible &&
    Math.abs(a.title.x - b.title.x) < 0.5 &&
    Math.abs(a.title.y - b.title.y) < 0.5 &&
    a.titleWidth === b.titleWidth &&
    a.placement === b.placement
  );
}

function AnnotationCard({
  annotation,
  left,
  top,
  width,
  arrowLeft,
  canManage,
  onCollapse,
  onEdit,
  onMeasureHeight,
}: {
  annotation: ModelAnnotation;
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  canManage: boolean;
  onCollapse: () => void;
  onEdit?: () => void;
  onMeasureHeight?: (height: number) => void;
}) {
  const images = annotation.media.filter((m) => m.mediaType === "image");
  const ref = useRef<HTMLDivElement>(null);
  // 图片大图预览：点击缩略图后放大查看的图片 URL（null 表示未打开预览）
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 首次挂载 / 内容变化时测量一次真实高度，回填给 layer 用于在标注点上方定位。
  // 不在 rAF 投影循环里调用，避免每帧 getBoundingClientRect。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    onMeasureHeight?.(h);
    // 图片加载后高度可能变化，监听一次 load 事件回填
    const imgs = Array.from(el.querySelectorAll("img"));
    const handle = () => onMeasureHeight?.(el.getBoundingClientRect().height);
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", handle, { once: true });
    });
    return () => {
      imgs.forEach((img) => img.removeEventListener("load", handle));
    };
  }, [annotation, onMeasureHeight]);
  // Esc 关闭图片预览：capture 阶段拦截并 stopPropagation，避免冒泡到页面级 Esc（关闭帮助/全屏），
  // 保证「关闭预览后标注内容框仍然展开」。
  useEffect(() => {
    if (!previewUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPreviewUrl(null);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [previewUrl]);
  // 根据图片数量决定网格列数与统一缩略图高度，避免横图/竖图高度不一致撑变形内容框
  const thumbCols =
    images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3";
  const thumbHeight = images.length === 1 ? "h-28" : "h-24";
  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md"
      style={{
        left,
        top,
        width,
        maxHeight: ANNOTATION_VISUAL.cardMaxHeight,
        background: ANNOTATION_VISUAL.bgCard,
        borderColor: ANNOTATION_VISUAL.borderCard,
        borderRadius: ANNOTATION_VISUAL.cardRadius,
        color: "white",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <h4 className="text-[14px] font-medium leading-tight">{annotation.title}</h4>
        <div className="flex items-center gap-1">
          {canManage && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-white/10"
            >
              编辑
            </button>
          ) : null}
          <button
            type="button"
            aria-label="收起"
            title="收起"
            onClick={onCollapse}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {annotation.description ? (
        <p className="mt-2 px-4 text-[13px] leading-relaxed text-gray-200">
          {annotation.description}
        </p>
      ) : null}

      {images.length > 0 ? (
        <div className={`mt-3 grid ${thumbCols} gap-2 px-4 pb-4`}>
          {images.map((m) => (
            <button
              key={m.id}
              type="button"
              title="点击查看大图"
              // 点击图片打开大图预览；stopPropagation 避免冒泡触发内容框/标注点/视角飞行
              onClick={(e) => {
                e.stopPropagation();
                setPreviewUrl(m.url);
              }}
              className={`group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 ${thumbHeight} cursor-zoom-in`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={m.fileName ?? "标注图片"}
                className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="pb-4" />
      )}

      {/* 内容框底部小箭头：朝下指向标注点，水平位置由 layer 计算（相对内容框左侧，已 clamp 到内边距内）。
          颜色与内容框背景一致；不使用长引线。 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: arrowLeft - ANNOTATION_VISUAL.arrowSize,
          bottom: -ANNOTATION_VISUAL.arrowSize,
          width: 0,
          height: 0,
          borderLeft: `${ANNOTATION_VISUAL.arrowSize}px solid transparent`,
          borderRight: `${ANNOTATION_VISUAL.arrowSize}px solid transparent`,
          borderTop: `${ANNOTATION_VISUAL.arrowSize}px solid ${ANNOTATION_VISUAL.bgCard}`,
        }}
      />

      {/* 图片大图预览：portal 到 document.body，fixed 定位脱离标注层 stacking context，
          z-[80] 高于内容框/工具栏/编辑器；Esc/遮罩/关闭按钮均可关闭，不影响标注内容框与视角飞行 */}
      {previewUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm"
              onClick={() => setPreviewUrl(null)}
            >
              <button
                type="button"
                aria-label="关闭预览"
                title="关闭预览（Esc）"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewUrl(null);
                }}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="标注图片预览"
                onClick={(e) => e.stopPropagation()}
                className="max-h-[80vh] max-w-[min(90vw,960px)] rounded-2xl object-contain shadow-2xl"
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** 便捷工具：读取当前视角（供外层 onSelectTitle 调用 applyView 前无需直接访问 handle） */
export function applyAnnotationView(
  handle: ModelViewerHandle | null | undefined,
  view: ModelLaunchView,
): boolean {
  return Boolean(handle?.applyView?.(view));
}
