import { useEffect, useState } from 'react';
import { Button, Input, Picker, Text, View } from '@tarojs/components';
import { DEFAULT_NOTICE } from '@/types';
import type { EventInfo } from '@/types';
import { isValidTimeRange, parseDateParts } from '@/lib/date';
import { loadRecentVenues, rememberVenue } from '@/lib/storage';
import { Sheet } from './Sheet';

interface EventSettingsSheetProps {
  open: boolean;
  event: EventInfo;
  groupCount: number;
  onClose: () => void;
  onSave: (event: EventInfo) => void;
}

/**
 * 活动信息编辑。
 *
 * 小程序用原生 Picker 选日期和时间，比自绘表单可靠得多；
 * 场馆沿用“最近使用”记忆，减少重复输入。
 */
export function EventSettingsSheet({
  open,
  event,
  groupCount,
  onClose,
  onSave,
}: EventSettingsSheetProps) {
  const [draft, setDraft] = useState<EventInfo>(event);
  const [recentVenues, setRecentVenues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(event);
    setRecentVenues(loadRecentVenues());
    setError(null);
  }, [open, event]);

  const update = <Key extends keyof EventInfo>(
    key: Key,
    value: EventInfo[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const handleSave = () => {
    if (!parseDateParts(draft.date)) {
      setError('请选择有效的日期');
      return;
    }
    if (!isValidTimeRange(draft.startTime, draft.endTime)) {
      setError('结束时间需要晚于开始时间');
      return;
    }
    const venue = draft.venue.trim();
    if (venue) rememberVenue(venue);
    onSave(draft);
    onClose();
  };

  return (
    <Sheet open={open} title="活动信息" onClose={onClose}>
      <View className="form">
        <View className="form-row">
          <Text className="form-label">标题</Text>
          <Input
            className="form-input"
            value={draft.title}
            maxlength={32}
            placeholder="本周羽毛球分组"
            onInput={(item) => update('title', item.detail.value)}
          />
        </View>

        <View className="form-row">
          <Text className="form-label">日期</Text>
          <Picker
            mode="date"
            value={draft.date}
            onChange={(item) => update('date', String(item.detail.value))}
          >
            <View className="form-picker">
              <Text className="form-picker__text">{draft.date}</Text>
            </View>
          </Picker>
        </View>

        <View className="form-row">
          <Text className="form-label">开始</Text>
          <Picker
            mode="time"
            value={draft.startTime}
            onChange={(item) => update('startTime', String(item.detail.value))}
          >
            <View className="form-picker">
              <Text className="form-picker__text">{draft.startTime}</Text>
            </View>
          </Picker>
        </View>

        <View className="form-row">
          <Text className="form-label">结束</Text>
          <Picker
            mode="time"
            value={draft.endTime}
            onChange={(item) => update('endTime', String(item.detail.value))}
          >
            <View className="form-picker">
              <Text className="form-picker__text">{draft.endTime}</Text>
            </View>
          </Picker>
        </View>

        <View className="form-row">
          <Text className="form-label">场馆</Text>
          <Input
            className="form-input"
            value={draft.venue}
            maxlength={40}
            placeholder="如：星光羽毛球馆"
            onInput={(item) => update('venue', item.detail.value)}
          />
        </View>

        {recentVenues.length > 0 ? (
          <View className="venue-chips">
            {recentVenues.map((venue) => (
              <Text
                className="venue-chip"
                key={venue}
                onClick={() => update('venue', venue)}
              >
                {venue}
              </Text>
            ))}
          </View>
        ) : null}

        <View className="form-row form-row--stack">
          <Text className="form-label">球局提示</Text>
          <Input
            className="form-input"
            value={draft.notice}
            maxlength={120}
            placeholder={DEFAULT_NOTICE}
            onInput={(item) => update('notice', item.detail.value)}
          />
        </View>

        {error ? <Text className="form-error">{error}</Text> : null}

        <View className="form-actions">
          <Button className="btn btn--soft" onClick={onClose}>
            取消
          </Button>
          <Button className="btn btn--dark" onClick={handleSave}>
            保存
          </Button>
        </View>

        <Text className="form-note">
          当前共 {groupCount} 个场次，修改只影响海报上的信息展示。
        </Text>
      </View>
    </Sheet>
  );
}
