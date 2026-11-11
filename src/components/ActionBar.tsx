import { Button, Text, View } from '@tarojs/components';

interface ActionBarProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  hint?: string;
}

/** 固定在底部的操作栏，承载每一步的主按钮。 */
export function ActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  hint,
}: ActionBarProps) {
  return (
    <View className="action-bar">
      {hint ? <Text className="action-bar__hint">{hint}</Text> : null}
      <View className="action-bar__row">
        {secondaryLabel && onSecondary ? (
          <Button
            className="btn btn--soft action-bar__secondary"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        <Button
          className={`btn btn--dark ${primaryDisabled ? 'btn--disabled' : ''}`}
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
      </View>
    </View>
  );
}
