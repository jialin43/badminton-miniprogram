import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { PosterLayout } from '@/lib/poster-layout';
import { renderPoster } from '@/lib/poster-render';
import type { PosterData } from '@/lib/poster-render';
import type { CanvasNode } from '@/lib/export';

interface PosterCanvasProps {
  data: PosterData;
  layout: PosterLayout;
  canvasId: string;
  /** 渲染完成回调，用于触发保存等后续操作 */
  onRendered?: (canvasId: string) => void;
  /**
   * 把画布节点实例交给父组件。
   * Canvas 2D 导出 canvasToTempFilePath 必须带这个实例，否则找不到画布。
   */
  onNodeReady?: (node: CanvasNode | null) => void;
}

/**
 * 海报绘制组件。
 *
 * 关键点：Canvas 的位图尺寸和显示尺寸是分开的。
 * - 位图固定按设计稿 1080×N，保证保存出来的图片足够清晰；
 * - 显示尺寸等比缩到屏幕宽度内，避免 1080px 撑爆布局。
 * 小程序必须先用 SelectorQuery 拿到节点，再设尺寸，最后把 ctx 交给渲染器。
 */
export function PosterCanvas({
  data,
  layout,
  canvasId,
  onRendered,
  onNodeReady,
}: PosterCanvasProps) {
  const nodeRef = useRef<CanvasNode | null>(null);
  const [display, setDisplay] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  // 显示尺寸：按屏幕宽度等比缩放
  useEffect(() => {
    const info = Taro.getSystemInfoSync();
    const maxWidth = (info.windowWidth || 375) - 32;
    const width = Math.min(maxWidth, layout.width);
    const height = (width * layout.height) / layout.width;
    setDisplay({ width, height });
  }, [layout.height, layout.width]);

  const setupCanvas = useCallback(() => {
    return new Promise<CanvasNode | null>((resolve) => {
      Taro.createSelectorQuery()
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res?.[0]?.node as CanvasNode | undefined;
          if (!node) {
            resolve(null);
            return;
          }

          // 位图按设计稿尺寸：导出的就是 1080px 宽
          node.width = layout.width;
          node.height = layout.height;

          if (!node.getContext('2d')) {
            resolve(null);
            return;
          }

          nodeRef.current = node;
          onNodeReady?.(node);
          resolve(node);
        });
    });
  }, [canvasId, layout.height, layout.width]);

  const draw = useCallback(async () => {
    const node = nodeRef.current ?? (await setupCanvas());
    if (!node) return;

    const context = node.getContext('2d');
    if (!context) return;

    renderPoster(context, data, layout);
    setReady(true);
    onRendered?.(canvasId);
  }, [canvasId, data, layout, onRendered, setupCanvas]);

  // 节点要等首帧渲染后才拿得到，拿不到就退避重试几次
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const run = async () => {
      if (cancelled) return;
      const node = await setupCanvas();
      if (cancelled) return;

      if (!node) {
        onNodeReady?.(null);
        attempt += 1;
        if (attempt < 5) {
          setTimeout(() => void run(), 120 * attempt);
        }
        return;
      }
      await draw();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [draw, onNodeReady, setupCanvas]);

  // 数据变化（改名、挪人）时重绘
  useEffect(() => {
    if (!ready) return;
    void draw();
  }, [data, draw, ready]);

  return (
    <View className="poster-canvas-wrap">
      <Canvas
        type="2d"
        id={canvasId}
        canvasId={canvasId}
        className="poster-canvas"
        style={{
          width: `${display.width}px`,
          height: `${display.height}px`,
        }}
      />
    </View>
  );
}
