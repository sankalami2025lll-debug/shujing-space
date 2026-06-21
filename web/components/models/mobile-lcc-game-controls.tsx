"use client";

/**
 * 组件名称：MobileLccGameControls
 * 组件用途：分享 iframe mobile=1 场景下的第一人称触控层
 * 主要功能：左半屏动态隐形摇杆移动、右半屏单指转头与双指捏合/平移、升/降（重置由 MobileLccViewerChrome 提供）
 * 对应路由：/viewer/lcc/[id]?mobile=1
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ModelViewerHandle, ModelViewerMovementInput } from "@/components/models/viewers/types";

/** 空移动输入 */
const EMPTY_MOVEMENT: ModelViewerMovementInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

/** 动态摇杆外圈半径（px），直径约 104px */
const JOYSTICK_OUTER_RADIUS = 52;
/** 动态摇杆内圈半径（px），直径约 44px */
const JOYSTICK_KNOB_RADIUS = 22;
/** 方向触发死区（px） */
const JOYSTICK_MOVE_THRESHOLD = 12;
/** 内圈最大偏移半径（px） */
const JOYSTICK_MAX_RADIUS = 52;
/** 左半屏移动区 / 右半屏视角区各占屏宽比例（互不重叠） */
const MOVE_ZONE_WIDTH_RATIO = 0.5;
const LOOK_ZONE_WIDTH_RATIO = 0.5;
/** 右侧转头区顶部留白（iframe 内无顶栏，预留安全区） */
const LOOK_ZONE_TOP_OFFSET_PX = 0;
/** 双指捏合 / 平移触发阈值（px），过滤轻微手抖 */
const TWO_FINGER_GESTURE_THRESHOLD_PX = 1.5;

type TouchPoint = {
  pointerId: number;
  x: number;
  y: number;
};

export interface MobileLccGameControlsProps {
  /** LccViewer 暴露的操作句柄，用于 resetView / setMovementInput / look / pinch / pan */
  viewerHandleRef: RefObject<ModelViewerHandle | null>;
  /** 同步父级 movementInput 状态，与键盘输入共用同一条链路 */
  onMovementInputChange: (input: ModelViewerMovementInput) => void;
  /** 帮助打开或模型未就绪时禁用触控 */
  disabled?: boolean;
}

export function MobileLccGameControls({
  viewerHandleRef,
  onMovementInputChange,
  disabled = false,
}: MobileLccGameControlsProps) {
  const movementRef = useRef<ModelViewerMovementInput>({ ...EMPTY_MOVEMENT });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  /** 动态摇杆外圈中心（相对控制层容器坐标），仅在 active 时使用 */
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 0, y: 0 });
  const [upActive, setUpActive] = useState(false);
  const [downActive, setDownActive] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [lookActive, setLookActive] = useState(false);

  const controlLayerRef = useRef<HTMLDivElement | null>(null);
  const moveZoneRef = useRef<HTMLDivElement | null>(null);
  const lookZoneRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerIdRef = useRef<number | null>(null);
  const lookPointerIdRef = useRef<number | null>(null);
  const lookLastPointRef = useRef<{ x: number; y: number } | null>(null);
  /** pointerdown 时的 client 坐标，作为摇杆中心与 dx/dy 基准 */
  const joystickCenterRef = useRef({ x: 0, y: 0 });

  /** 右侧触控区内活跃 pointer（仅本区域参与双指手势） */
  const activeLookPointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const lastPinchDistanceRef = useRef<number | null>(null);
  const lastGestureCenterRef = useRef<{ x: number; y: number } | null>(null);
  const isTwoFingerGestureRef = useRef(false);
  /** 双指手势结束后，需全部抬起才允许再次单指转头 */
  const blockSingleLookUntilReleaseRef = useRef(false);

  const applyMovement = useCallback(
    (next: ModelViewerMovementInput) => {
      movementRef.current = next;
      onMovementInputChange(next);
      viewerHandleRef.current?.setMovementInput?.(next);
    },
    [onMovementInputChange, viewerHandleRef],
  );

  const stopLookingState = useCallback(() => {
    lookPointerIdRef.current = null;
    lookLastPointRef.current = null;
    setLookActive(false);
  }, []);

  const clearTwoFingerGesture = useCallback(() => {
    lastPinchDistanceRef.current = null;
    lastGestureCenterRef.current = null;
    isTwoFingerGestureRef.current = false;
  }, []);

  const clearLookZoneGestureState = useCallback(() => {
    activeLookPointersRef.current.clear();
    clearTwoFingerGesture();
    stopLookingState();
    blockSingleLookUntilReleaseRef.current = false;
  }, [clearTwoFingerGesture, stopLookingState]);

  const clearJoystickDirections = useCallback(() => {
    applyMovement({
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: movementRef.current.up,
      down: movementRef.current.down,
    });
  }, [applyMovement]);

  const stopAllMovement = useCallback(() => {
    movementRef.current = { ...EMPTY_MOVEMENT };
    setKnobOffset({ x: 0, y: 0 });
    setJoystickOrigin({ x: 0, y: 0 });
    setUpActive(false);
    setDownActive(false);
    setJoystickActive(false);
    joystickPointerIdRef.current = null;
    clearLookZoneGestureState();
    applyMovement({ ...EMPTY_MOVEMENT });
  }, [applyMovement, clearLookZoneGestureState]);

  useEffect(() => {
    const handle = viewerHandleRef;
    return () => {
      onMovementInputChange({ ...EMPTY_MOVEMENT });
      handle.current?.setMovementInput?.({ ...EMPTY_MOVEMENT });
      clearLookZoneGestureState();
    };
  }, [clearLookZoneGestureState, onMovementInputChange, viewerHandleRef]);

  useEffect(() => {
    if (disabled) {
      stopAllMovement();
    }
  }, [disabled, stopAllMovement]);

  const initTwoFingerMetrics = useCallback((pointers: TouchPoint[]) => {
    if (pointers.length < 2) {
      return;
    }
    const [p1, p2] = pointers;
    lastPinchDistanceRef.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    lastGestureCenterRef.current = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }, []);

  const processTwoFingerGesture = useCallback(
    (pointers: TouchPoint[]) => {
      if (pointers.length < 2) {
        return;
      }

      const [p1, p2] = pointers;
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;

      const lastDistance = lastPinchDistanceRef.current;
      const lastCenter = lastGestureCenterRef.current;

      if (lastDistance !== null && lastCenter !== null) {
        const distanceDelta = distance - lastDistance;
        const centerDeltaX = centerX - lastCenter.x;
        const centerDeltaY = centerY - lastCenter.y;

        if (Math.abs(distanceDelta) > TWO_FINGER_GESTURE_THRESHOLD_PX) {
          viewerHandleRef.current?.moveAlongView?.({
            amount: distanceDelta,
            source: "mobile",
          });
        }

        if (
          Math.abs(centerDeltaX) > TWO_FINGER_GESTURE_THRESHOLD_PX ||
          Math.abs(centerDeltaY) > TWO_FINGER_GESTURE_THRESHOLD_PX
        ) {
          viewerHandleRef.current?.panByDelta?.({
            x: centerDeltaX,
            y: centerDeltaY,
            source: "mobile",
          });
        }
      }

      lastPinchDistanceRef.current = distance;
      lastGestureCenterRef.current = { x: centerX, y: centerY };
    },
    [viewerHandleRef],
  );

  const applyJoystickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - joystickCenterRef.current.x;
      const dy = clientY - joystickCenterRef.current.y;
      const distance = Math.hypot(dx, dy);
      const clampedDistance = Math.min(distance, JOYSTICK_MAX_RADIUS);
      const angle = Math.atan2(dy, dx);
      const clampedX = Math.cos(angle) * clampedDistance;
      const clampedY = Math.sin(angle) * clampedDistance;

      setKnobOffset({ x: clampedX, y: clampedY });

      applyMovement({
        forward: dy < -JOYSTICK_MOVE_THRESHOLD,
        backward: dy > JOYSTICK_MOVE_THRESHOLD,
        left: dx < -JOYSTICK_MOVE_THRESHOLD,
        right: dx > JOYSTICK_MOVE_THRESHOLD,
        up: movementRef.current.up,
        down: movementRef.current.down,
      });
    },
    [applyMovement],
  );

  const handleMoveZonePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const layer = controlLayerRef.current;
      if (!layer) return;

      const rect = layer.getBoundingClientRect();
      joystickCenterRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      setJoystickOrigin({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      joystickPointerIdRef.current = event.pointerId;
      setJoystickActive(true);
      setKnobOffset({ x: 0, y: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
      applyJoystickFromClient(event.clientX, event.clientY);
    },
    [applyJoystickFromClient, disabled],
  );

  const handleMoveZonePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || joystickPointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      applyJoystickFromClient(event.clientX, event.clientY);
    },
    [applyJoystickFromClient, disabled],
  );

  const releaseJoystick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (joystickPointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      joystickPointerIdRef.current = null;
      setJoystickActive(false);
      setKnobOffset({ x: 0, y: 0 });
      clearJoystickDirections();

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* 指针可能已释放 */
      }
    },
    [clearJoystickDirections],
  );

  const setVerticalAxis = useCallback(
    (axis: "up" | "down", active: boolean) => {
      if (disabled) return;
      if (axis === "up") setUpActive(active);
      else setDownActive(active);

      applyMovement({
        ...movementRef.current,
        up: axis === "up" ? active : movementRef.current.up,
        down: axis === "down" ? active : movementRef.current.down,
      });
    },
    [applyMovement, disabled],
  );

  const handleLookPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const point: TouchPoint = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      activeLookPointersRef.current.set(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);

      if (isTwoFingerGestureRef.current || blockSingleLookUntilReleaseRef.current) {
        return;
      }

      if (activeLookPointersRef.current.size >= 2) {
        isTwoFingerGestureRef.current = true;
        blockSingleLookUntilReleaseRef.current = true;
        stopLookingState();
        initTwoFingerMetrics(Array.from(activeLookPointersRef.current.values()));
        return;
      }

      lookPointerIdRef.current = event.pointerId;
      lookLastPointRef.current = { x: event.clientX, y: event.clientY };
      setLookActive(true);
    },
    [disabled, initTwoFingerMetrics, stopLookingState],
  );

  const handleLookPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !activeLookPointersRef.current.has(event.pointerId)) return;
      event.preventDefault();
      event.stopPropagation();

      activeLookPointersRef.current.set(event.pointerId, {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      });

      const pointers = Array.from(activeLookPointersRef.current.values());

      if (pointers.length >= 2) {
        if (!isTwoFingerGestureRef.current) {
          isTwoFingerGestureRef.current = true;
          blockSingleLookUntilReleaseRef.current = true;
          stopLookingState();
          initTwoFingerMetrics(pointers);
          return;
        }

        processTwoFingerGesture(pointers);
        return;
      }

      if (isTwoFingerGestureRef.current || blockSingleLookUntilReleaseRef.current) {
        return;
      }

      if (lookPointerIdRef.current !== event.pointerId) return;

      const lastPoint = lookLastPointRef.current;
      if (!lastPoint) return;

      const deltaX = event.clientX - lastPoint.x;
      const deltaY = event.clientY - lastPoint.y;
      if (deltaX === 0 && deltaY === 0) return;

      viewerHandleRef.current?.lookByDelta?.({ x: deltaX, y: deltaY, source: "mobile" });
      lookLastPointRef.current = { x: event.clientX, y: event.clientY };
    },
    [disabled, initTwoFingerMetrics, processTwoFingerGesture, stopLookingState, viewerHandleRef],
  );

  const handleLookPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activeLookPointersRef.current.has(event.pointerId)) return;
      event.preventDefault();
      event.stopPropagation();

      activeLookPointersRef.current.delete(event.pointerId);

      if (lookPointerIdRef.current === event.pointerId) {
        stopLookingState();
      }

      if (activeLookPointersRef.current.size < 2) {
        clearTwoFingerGesture();
      }

      if (activeLookPointersRef.current.size === 0) {
        blockSingleLookUntilReleaseRef.current = false;
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* 指针可能已释放 */
      }
    },
    [clearTwoFingerGesture, stopLookingState],
  );

  if (disabled) {
    return null;
  }

  const controlLayerStyle: React.CSSProperties = {
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    overscrollBehavior: "none",
  };

  return (
    <div
      ref={controlLayerRef}
      className="pointer-events-none absolute inset-0 z-30"
      data-mobile-lcc-controls="true"
      aria-hidden={false}
    >
      {/* 右半屏视角区：单指转头 + 双指捏合/平移（与左半屏移动区不重叠） */}
      <div
        ref={lookZoneRef}
        role="presentation"
        data-mobile-look-zone="true"
        className="pointer-events-auto absolute z-10"
        style={{
          top: LOOK_ZONE_TOP_OFFSET_PX,
          bottom: 0,
          left: `${MOVE_ZONE_WIDTH_RATIO * 100}%`,
          width: `${LOOK_ZONE_WIDTH_RATIO * 100}%`,
          ...controlLayerStyle,
        }}
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        aria-hidden={lookActive}
      />

      {/* 左半屏隐形移动区：按下时在触点显示动态摇杆（与右半屏视角区不重叠） */}
      <div
        ref={moveZoneRef}
        role="presentation"
        data-mobile-move-zone="true"
        className="pointer-events-auto absolute left-0 top-0 bottom-0 z-[15]"
        style={{
          width: `${MOVE_ZONE_WIDTH_RATIO * 100}%`,
          ...controlLayerStyle,
        }}
        onPointerDown={handleMoveZonePointerDown}
        onPointerMove={handleMoveZonePointerMove}
        onPointerUp={releaseJoystick}
        onPointerCancel={releaseJoystick}
      />

      {/* 动态摇杆：仅在 pointerdown 后显示于按下位置 */}
      {joystickActive && (
        <div
          className="pointer-events-none absolute z-20"
          data-mobile-dynamic-joystick="true"
          style={{
            left: joystickOrigin.x,
            top: joystickOrigin.y,
            transform: "translate(-50%, -50%)",
            ...controlLayerStyle,
          }}
        >
          <div
            role="presentation"
            className="relative flex items-center justify-center rounded-full border border-white/25 bg-white/[0.22] backdrop-blur-[2px]"
            style={{
              width: JOYSTICK_OUTER_RADIUS * 2,
              height: JOYSTICK_OUTER_RADIUS * 2,
            }}
          >
            <div
              className="absolute rounded-full border border-white/45 bg-white/[0.42]"
              style={{
                width: JOYSTICK_KNOB_RADIUS * 2,
                height: JOYSTICK_KNOB_RADIUS * 2,
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* 右下角升 / 降 */}
      <div
        className="pointer-events-auto absolute bottom-6 right-6 z-20 flex flex-col gap-2"
        style={controlLayerStyle}
      >
        <MobileActionButton
          label="升"
          active={upActive}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("up", true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("up", false);
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("up", false);
          }}
        />
        <MobileActionButton
          label="降"
          active={downActive}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("down", true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("down", false);
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVerticalAxis("down", false);
          }}
        />
      </div>
    </div>
  );
}

function MobileActionButton({
  label,
  active = false,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  label: string;
  active?: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`min-w-[52px] rounded-lg border px-4 py-2.5 text-[14px] font-medium text-white transition-colors ${
        active
          ? "border-cyan-400/50 bg-cyan-950/70 text-cyan-100"
          : "border-white/15 bg-black/45 text-gray-100 hover:border-white/25 hover:bg-black/55"
      }`}
      style={{
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        overscrollBehavior: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {label}
    </button>
  );
}
