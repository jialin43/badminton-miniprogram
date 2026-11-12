import { useCallback, useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';

/**
 * 拖拽落点。
 *
 * 两种精度：
 * - 落在场次空白处 → 只有 groupId，表示「加入这个场次」
 * - 落在某个成员身上 → 同时带 playerId，表示「与这个人互换」
 */
export interface DropTarget {
  /** 场次 id；null 表示后补名单 */
  groupId: string | null;
  /** 命中的具体成员 id；仅当正好落在某张成员卡上时存在 */
  playerId?: string | null;
}

export interface DragState {
  /** 正在被拖动的成员 id */
  playerId: string;
  /** 手指当前坐标（页面坐标） */
  x: number;
  y: number;
  /** 当前悬停的落点，用于高亮 */
  over: DropTarget | null;
}

/** 判定为拖拽所需的最小位移（px），小于此值按点击处理。 */
const DRAG_THRESHOLD = 8;
/** 长按多久进入拖拽。 */
const LONG_PRESS_MS = 180;

interface Rect {
  groupId: string | null;
  /** 命中的成员 id；场次/后补容器本身的矩形没有这个字段 */
  playerId: string | null;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 落点测量所需的布局快照：顺序必须与页面渲染顺序完全一致。 */
export interface DragLayout {
  /** 后补区成员 id，按渲染顺序 */
  waitlistIds: string[];
  /** 各场次及其成员，按渲染顺序 */
  groups: Array<{ id: string; playerIds: string[] }>;
}

interface RawRect {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

/** 把查询结果规整成一定含四个数字的矩形列表，缺字段的直接丢弃。 */
function normalizeRects(value: unknown): Array<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  if (!Array.isArray(value)) return [];

  const out: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const rect = entry as RawRect;
    if (
      typeof rect.left !== 'number' ||
      typeof rect.top !== 'number' ||
      typeof rect.right !== 'number' ||
      typeof rect.bottom !== 'number'
    ) {
      continue;
    }
    out.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }
  return out;
}

interface TouchPoint {
  clientX: number;
  clientY: number;
}

type TouchLike = {
  touches?: TouchPoint[];
  changedTouches?: TouchPoint[];
};

/**
 * 分组页拖拽。
 *
 * 关键实现约束（踩过的坑）：
 * 1. touchmove / touchend 必须绑在**被拖动的卡片自身**上。
 *    一开始我把它们挂在页面根节点，靠冒泡接事件。但手指一旦离开
 *    卡片区域，小程序会把 touchend 派发给卡片自己的节点，
 *    根节点收不到 → 松手后拖拽状态卡住，落点判定永远不执行，
 *    表现就是「卡片抬起来但没有后续动作」。
 * 2. 不要用 catchMove（catchtouchmove）。它会截断事件，
 *    touchend 可能一并丢失。暂停列表滚动只靠 ScrollView 的
 *    scrollY={false} 就够了，那是一个属性开关，稳定得多。
 * 3. 拖拽期间卡片可能因 dragging 样式变化而重渲染，
 *    所以落点矩形在进入拖拽时量一次并缓存，松手时只做纯计算。
 */
export function useDragDrop(options: {
  onDrop: (playerId: string, target: DropTarget) => void;
  /** 拖拽开始/结束时通知外部（用于暂停列表滚动） */
  onDraggingChange?: (dragging: boolean) => void;
  /** 当前落点布局快照，顺序必须与渲染顺序一致 */
  layout: DragLayout;
  /** 拖拽不可用时的兜底：打开点按移动面板 */
  onFallback?: (playerId: string) => void;
}) {
  const { onDrop, onDraggingChange, layout, onFallback } = options;
  const [drag, setDrag] = useState<DragState | null>(null);

  // 用 ref 持有最新的布局，避免每次渲染都重建回调
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /** 手指按下位置与候选成员 */
  const pending = useRef<{
    playerId: string;
    startX: number;
    startY: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  /** 各落点的包围盒，进入拖拽时量一次 */
  const rects = useRef<Rect[]>([]);

  /** 记录上一次通知给外部的拖拽状态，避免重复回调 */
  const draggingNotified = useRef(false);

  const notifyDragging = useCallback(
    (dragging: boolean) => {
      if (draggingNotified.current === dragging) return;
      draggingNotified.current = dragging;
      onDraggingChange?.(dragging);
    },
    [onDraggingChange],
  );

  /**
   * 量出所有落点的包围盒。
   *
   * 用 class 选择器（.group-card）而不是 [data-xxx]：
   * Taro 的 React 层不保证 data-* 一定落到小程序节点属性上，
   * 而且 createSelectorQuery 在自定义组件内的作用域也容易查不到节点。
   * class 选择器配合「测量顺序 == 渲染顺序」最稳：
   * 卡片按 state.groups 顺序渲染，后补区排在最前，所以
   * groups[i] 对应 groupIds[i]。
   */
  const measureTargets = useCallback(
    (layout: DragLayout) => {
      return new Promise<Rect[]>((resolve) => {
        const query = Taro.createSelectorQuery();
        // .page-content 是 GroupStep 的根节点，限定作用域避免选到别的步骤
        query.selectAll('.page-content .group-card').boundingClientRect();
        query.selectAll('.page-content .player-card').boundingClientRect();
        query.select('.page-content .pool').boundingClientRect();
        query.exec((res) => {
          const groupRects = normalizeRects(res?.[0]);
          const playerRects = normalizeRects(res?.[1]);
          const poolRect = (Array.isArray(res?.[2]) ? null : res?.[2]) as RawRect | null;

          const list: Rect[] = [];

          // ① 场次容器：只表示「加入这个场次」
          groupRects.forEach((rect, index) => {
            list.push({
              ...rect,
              groupId: layout.groups[index]?.id ?? null,
              playerId: null,
            });
          });

          // ② 后补区容器
          if (poolRect && typeof poolRect.left === 'number' && typeof poolRect.top === 'number') {
            list.push({
              groupId: null,
              playerId: null,
              left: poolRect.left,
              top: poolRect.top,
              right: poolRect.right ?? 0,
              bottom: poolRect.bottom ?? 0,
            });
          }

          // ③ 成员卡：按渲染顺序反推归属。
          //    渲染顺序是「后补区成员 → 各场次成员」，与 layout 一致，
          //    所以用一个游标顺序消费即可，不依赖 dataset。
          const ownerOf: Array<{ groupId: string | null; playerId: string }> = [];
          for (const id of layout.waitlistIds) {
            ownerOf.push({ groupId: null, playerId: id });
          }
          for (const group of layout.groups) {
            for (const id of group.playerIds) {
              ownerOf.push({ groupId: group.id, playerId: id });
            }
          }

          playerRects.forEach((rect, index) => {
            const owner = ownerOf[index];
            if (!owner) return;
            list.push({
              ...rect,
              groupId: owner.groupId,
              playerId: owner.playerId,
            });
          });

          if (list.length === 0) {
            console.warn(
              '[drag] 没量到落点矩形，拖放将无法判定。groupRects =',
              groupRects,
            );
          }

          resolve(list);
        });
      });
    },
    [],
  );

  /**
   * 命中判定。
   *
   * 优先命中「具体成员卡」，其次才是场次/后补容器。
   * 这样把 A 拖到 B 组的某个人身上时，能拿到精确的互换对象；
   * 只落在场次空白处时才退化成「加入该场次」。
   */
  const hitTest = useCallback((x: number, y: number): DropTarget | null => {
    let containerHit: DropTarget | null = null;

    for (const rect of rects.current) {
      const inside =
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom;
      if (!inside) continue;

      if (rect.playerId) {
        // 成员卡直接返回，精确互换
        return { groupId: rect.groupId, playerId: rect.playerId };
      }

      // 容器命中先记下，继续找有没有更精确的成员卡
      if (!containerHit) {
        containerHit = { groupId: rect.groupId, playerId: null };
      }
    }

    return containerHit;
  }, []);

  const clearPending = useCallback(() => {
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);

  /**
   * 进入拖拽：量落点 + 设置状态。
   *
   * 如果量不到任何落点（选择器在某些环境失效），就不进入拖拽，
   * 而是退回「打开移动面板」，避免出现「卡片抬起来却放不下」的死状态。
   */
  const beginDrag = useCallback(
    (playerId: string, x: number, y: number) => {
      void measureTargets(layoutRef.current).then((list) => {
        if (list.length === 0) {
          console.warn('[drag] 未取到落点，降级为点按移动');
          pending.current = null;
          notifyDragging(false);
          onFallback?.(playerId);
          return;
        }

        rects.current = list;
        notifyDragging(true);
        setDrag({ playerId, x, y, over: hitTest(x, y) });
      });
    },
    [hitTest, measureTargets, notifyDragging, onFallback],
  );

  /** 卡片绑定：onTouchStart */
  const startDrag = useCallback(
    (playerId: string, event: TouchLike) => {
      const touch = event.touches?.[0];
      if (!touch) return;

      clearPending();

      // 按下即暂停列表滚动。
      // 如果等长按 / 位移阈值满足后再暂停，中间那段 touchmove 会被
      // ScrollView 先吃掉，手指一移动列表就滚，拖拽永远起不来。
      notifyDragging(true);

      pending.current = {
        playerId,
        startX: touch.clientX,
        startY: touch.clientY,
        active: false,
        timer: setTimeout(() => {
          // 长按未移动：直接进入拖拽，给用户“拿起来”的反馈
          const current = pending.current;
          if (!current || current.active) return;
          current.active = true;
          beginDrag(current.playerId, current.startX, current.startY);
        }, LONG_PRESS_MS),
      };
    },
    [beginDrag, clearPending, notifyDragging],
  );

  /** 卡片绑定：onTouchMove */
  const moveDrag = useCallback(
    (event: TouchLike) => {
      const current = pending.current;
      if (!current) return;
      const touch = event.touches?.[0];
      if (!touch) return;

      const dx = Math.abs(touch.clientX - current.startX);
      const dy = Math.abs(touch.clientY - current.startY);

      // 还没进拖拽：位移够大就升级为拖拽（并取消长按定时器）
      if (!current.active) {
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
        current.active = true;
        if (current.timer) clearTimeout(current.timer);
        beginDrag(current.playerId, touch.clientX, touch.clientY);
        return;
      }

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: touch.clientX,
              y: touch.clientY,
              over: hitTest(touch.clientX, touch.clientY),
            }
          : prev,
      );
    },
    [beginDrag, hitTest],
  );

  /** 卡片绑定：onTouchEnd */
  const endDrag = useCallback(
    (event: TouchLike) => {
      const current = pending.current;
      clearPending();
      if (!current) return;

      if (!current.active) {
        // 没进入拖拽 → 交给卡片的 onClick 处理（弹出移动面板）
        setDrag(null);
        notifyDragging(false);
        return;
      }

      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      const x = touch?.clientX ?? 0;
      const y = touch?.clientY ?? 0;

      // 用松手坐标做命中判定；拿不到坐标时用最后一次悬停结果兜底
      const target = touch ? hitTest(x, y) : (drag?.over ?? null);

      setDrag(null);
      rects.current = [];
      notifyDragging(false);

      if (target) onDrop(current.playerId, target);
    },
    [clearPending, drag, hitTest, notifyDragging, onDrop],
  );

  // 组件卸载时清掉未触发的长按定时器
  useEffect(
    () => () => {
      clearPending();
      notifyDragging(false);
    },
    [clearPending, notifyDragging],
  );

  return {
    drag,
    isDragging: drag !== null,
    startDrag,
    moveDrag,
    endDrag,
  };
}
