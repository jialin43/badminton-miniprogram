import { Text, View } from '@tarojs/components';

export type IconName =
  | 'shuttle'
  | 'upload'
  | 'file'
  | 'sparkle'
  | 'shuffle'
  | 'undo'
  | 'trash'
  | 'edit'
  | 'grip'
  | 'arrow-left'
  | 'arrow-right'
  | 'check'
  | 'close'
  | 'image'
  | 'download'
  | 'share'
  | 'calendar'
  | 'pin'
  | 'users'
  | 'plus'
  | 'move'
  | 'alert'
  | 'settings'
  | 'refresh'
  | 'copy';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/**
 * 轻量图标。
 *
 * 小程序主包有 2MB 限制，引入整套图标库不划算，
 * 这里用 Unicode 符号覆盖全部场景，断网也能显示。
 */
const GLYPHS: Record<IconName, string> = {
  shuttle: '🏸',
  upload: '↑',
  file: '▤',
  sparkle: '✦',
  shuffle: '⇄',
  undo: '↺',
  trash: '⌫',
  edit: '✎',
  grip: '⠿',
  'arrow-left': '‹',
  'arrow-right': '›',
  check: '✓',
  close: '✕',
  image: '▣',
  download: '↓',
  share: '↗',
  calendar: '▦',
  pin: '◉',
  users: '☰',
  plus: '+',
  move: '⇅',
  alert: '!',
  settings: '⚙',
  refresh: '↻',
  copy: '⧉',
};

export function Icon({ name, size = 22, color }: IconProps) {
  return (
    <Text
      className={`icon icon--${name}`}
      style={{
        fontSize: `${size}rpx`,
        color: color ?? 'currentColor',
        lineHeight: 1,
      }}
    >
      {GLYPHS[name]}
    </Text>
  );
}

/** 品牌位的大号羽毛球，单独封装方便控制字号。 */
export function ShuttleIcon({ size = 22 }: { size?: number }) {
  return (
    <View
      className="shuttle-icon"
      style={{ fontSize: `${size}rpx`, lineHeight: 1 }}
    >
      🏸
    </View>
  );
}
