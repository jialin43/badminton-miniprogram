import { View, Text, Button } from '@tarojs/components';
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 底部弹出面板。
 *
 * 小程序没有 DOM，用固定定位 + 遮罩模拟；
 * 关闭方式包括点遮罩、点右上角关闭。
 */
export function Sheet({ open, title, subtitle, onClose, children }: SheetProps) {
  if (!open) return null;

  return (
    <View className="sheet-root">
      <View className="sheet-mask" onClick={onClose} />
      <View className="sheet-panel">
        <View className="sheet-head">
          <View className="sheet-head-text">
            <Text className="sheet-title">{title}</Text>
            {subtitle ? <Text className="sheet-subtitle">{subtitle}</Text> : null}
          </View>
          <Button className="sheet-close" onClick={onClose}>
            ✕
          </Button>
        </View>
        <View className="sheet-body">{children}</View>
      </View>
    </View>
  );
}
