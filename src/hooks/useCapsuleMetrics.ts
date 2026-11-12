import { useMemo } from 'react';
import Taro from '@tarojs/taro';

/**
 * 微信胶囊按钮占位信息。
 *
 * 为什么需要它：小程序右上角的胶囊（··· 和 ⊙）是系统绘制的浮层，
 * 页面内容会从它底下穿过去。只用 env(safe-area-inset-top) 不够：
 * 那个值在大量安卓机型上是 0，而胶囊实际还在那儿，
 * 于是 hero 右上角的 STEP 标签就被胶囊压住了。
 *
 * 正确做法是读 getMenuButtonBoundingClientRect()，
 * 拿到胶囊的 top / height / right，据此让出空间。
 */
export interface CapsuleMetrics {
  /** 状态栏到胶囊顶部的距离，即 hero 顶部需要额外让开的高度（px） */
  top: number;
  /** 胶囊高度（px） */
  height: number;
  /** 胶囊左边界距屏幕右侧的距离（px），右侧内容需要避开 */
  rightGap: number;
  /** 胶囊距屏幕左边的距离（px），可用于左侧对齐 */
  left: number;
  /** 是否取到了真实值。false 表示降级估算。 */
  measured: boolean;
}

/** 胶囊读取失败时的经验值（px） */
const FALLBACK: CapsuleMetrics = {
  top: 26,
  height: 32,
  rightGap: 96,
  left: 280,
  measured: false,
};

export function useCapsuleMetrics(): CapsuleMetrics {
  return useMemo<CapsuleMetrics>(() => {
    try {
      const rect = Taro.getMenuButtonBoundingClientRect();
      if (!rect || !rect.height || !rect.top) return FALLBACK;

      const info = Taro.getSystemInfoSync();
      const screenWidth = info.windowWidth || 375;

      return {
        top: rect.top,
        height: rect.height,
        rightGap: Math.max(0, screenWidth - rect.left),
        left: rect.left,
        measured: true,
      };
    } catch {
      return FALLBACK;
    }
  }, []);
}
