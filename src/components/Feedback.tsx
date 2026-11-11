import { useCallback } from 'react';
import Taro from '@tarojs/taro';

/**
 * 轻提示。
 *
 * 直接走 Taro 原生 toast：不占渲染层、无层级问题，
 * 小程序里比自绘浮层可靠得多。
 */
export function useToast(): (message: string) => void {
  return useCallback((message: string) => {
    void Taro.showToast({
      title: message,
      icon: 'none',
      duration: 2400,
    });
  }, []);
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * 二次确认。
 *
 * 返回 true 表示用户点了确认。
 * 小程序 modal 的确认/取消文案最多 4 个汉字，这里统一截断。
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        Taro.showModal({
          title: options.title,
          content: options.message,
          confirmText: (options.confirmLabel ?? '确定').slice(0, 4),
          cancelText: '取消',
          confirmColor: options.danger ? '#c9484d' : '#0e2a1f',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false),
        });
      }),
    [],
  );
}
