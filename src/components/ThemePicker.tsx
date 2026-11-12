import { Text, View } from '@tarojs/components';
import { POSTER_THEMES } from '@/lib/poster-theme';

interface ThemePickerProps {
  value: string;
  onChange: (themeId: string) => void;
}

/**
 * 海报主题选择器。
 *
 * 只切换海报配色，界面本身的绿色品牌色不动——
 * 这样用户换风格时页面不会跟着变成一整套新皮肤，
 * 视觉上仍然是一个稳定的工具。
 *
 * 色块用主题的 accent 色做圆点，选中态用描边圈出来，
 * 不依赖文字说明也能一眼看出每个主题是什么调子。
 */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <View className="theme-picker">
      <View className="theme-picker__head">
        <Text className="section-kicker">POSTER THEME</Text>
        <Text className="panel-title">海报配色</Text>
      </View>

      <View className="theme-list">
        {POSTER_THEMES.map((theme) => {
          const active = theme.id === value;
          return (
            <View
              key={theme.id}
              className={`theme-item ${active ? 'is-active' : ''}`}
              onClick={() => onChange(theme.id)}
            >
              <View
                className="theme-dot"
                style={{ background: theme.swatch }}
              />
              <Text className="theme-name">{theme.name}</Text>
            </View>
          );
        })}
      </View>

      <Text className="theme-hint">
        {POSTER_THEMES.find((theme) => theme.id === value)?.hint ??
          '选一个喜欢的配色'}
      </Text>
    </View>
  );
}
