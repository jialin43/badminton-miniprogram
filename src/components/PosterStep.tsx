import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { AppState, Player } from '@/types';
import type { AppAction } from '@/state/reducer';
import { buildPosterLayout } from '@/lib/poster-layout';
import type { PosterData } from '@/lib/poster-render';
import type { CanvasNode } from '@/lib/export';
import {
  canvasToTempPath,
  openAlbumSetting,
  previewPoster,
  saveCanvasToAlbum,
} from '@/lib/export';
import { ActionBar } from './ActionBar';
import { useToast } from './Feedback';
import { Icon } from './Icon';
import { NoticeCard } from './NoticeCard';
import { PosterCanvas } from './PosterCanvas';
import { ThemePicker } from './ThemePicker';

interface PosterStepProps {
  state: AppState;
  dispatch: (action: AppAction) => void;
  onBack: () => void;
  onOpenSettings: () => void;
}

const CANVAS_ID = 'posterCanvas';

export function PosterStep({
  state,
  dispatch,
  onBack,
  onOpenSettings,
}: PosterStepProps) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const canvasNodeRef = useRef<CanvasNode | null>(null);

  const handleNodeReady = useCallback((node: CanvasNode | null) => {
    canvasNodeRef.current = node;
  }, []);

  const playerMap = useMemo(
    () => new Map(state.players.map((player) => [player.id, player])),
    [state.players],
  );

  const data = useMemo<PosterData>(() => {
    const groups = state.groups
      .map((group) => ({
        label: group.label,
        players: group.playerIds
          .map((id) => playerMap.get(id))
          .filter((player): player is Player => Boolean(player))
          .map((player) => ({ name: player.name, isFemale: player.isFemale })),
      }))
      .filter((group) => group.players.length > 0);

    const waitlist = state.unassignedIds
      .map((id) => playerMap.get(id))
      .filter((player): player is Player => Boolean(player))
      .map((player) => ({ name: player.name, isFemale: player.isFemale }));

    const totalPlayers =
      groups.reduce((total, group) => total + group.players.length, 0) +
      waitlist.length;
    const femaleCount =
      groups.reduce(
        (total, group) =>
          total + group.players.filter((player) => player.isFemale).length,
        0,
      ) + waitlist.filter((player) => player.isFemale).length;

    return {
      title: state.event.title,
      date: state.event.date,
      startTime: state.event.startTime,
      endTime: state.event.endTime,
      venue: state.event.venue,
      capacity: state.capacity,
      notice: state.event.notice,
      themeId: state.themeId,
      groups,
      waitlist,
      totalPlayers,
      femaleCount,
    };
  }, [
    playerMap,
    state.capacity,
    state.event,
    state.groups,
    state.themeId,
    state.unassignedIds,
  ]);

  const layout = useMemo(
    () => buildPosterLayout(data.groups.length, data.waitlist.length),
    [data.groups.length, data.waitlist.length],
  );

  /** 保存到相册；被拒时引导去设置页，或改用预览长按保存。 */
  const handleSave = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    try {
      const node = canvasNodeRef.current;
      if (!node) {
        notify('海报还在绘制中，请稍等一下再保存');
        return;
      }

      const result = await saveCanvasToAlbum(CANVAS_ID, node);

      if (result.ok) {
        notify('已保存到相册');
        return;
      }

      if (result.reason === 'denied') {
        const res = await Taro.showModal({
          title: '需要相册权限',
          content: '保存海报需要访问相册。也可以先预览大图，长按保存。',
          confirmText: '去设置',
          cancelText: '预览',
        });

        if (res.confirm) {
          await openAlbumSetting();
        } else {
          const path = await canvasToTempPath(CANVAS_ID, node);
          await previewPoster(path);
        }
        return;
      }

      notify('保存失败了，试试长按预览图保存');
    } catch {
      notify('保存失败了，请稍后重试');
    } finally {
      setBusy(false);
    }
  }, [busy, notify]);

  /** 预览大图，用户可以长按保存或转发。 */
  const handlePreview = useCallback(async () => {
    try {
      const path = await canvasToTempPath(CANVAS_ID, canvasNodeRef.current);
      await previewPoster(path);
    } catch {
      notify('预览失败，请稍后重试');
    }
  }, [notify]);

  return (
    <View className="page-content page-content--with-bar">
      <View className="poster-card">
        <View className="poster-card__head">
          <View>
            <Text className="section-kicker">LIVE PREVIEW</Text>
            <Text className="panel-title">海报预览</Text>
          </View>
          <Text className="badge">
            {layout.width} × {layout.height}
          </Text>
        </View>

        <PosterCanvas
          data={data}
          layout={layout}
          canvasId={CANVAS_ID}
          onNodeReady={handleNodeReady}
        />

        <View className="poster-actions">
          <Button className="btn btn--dark btn--block" onClick={() => void handlePreview()}>
            <Icon name="image" size={24} />
            预览大图（可长按保存）
          </Button>
        </View>
      </View>

      <ThemePicker
        value={state.themeId}
        onChange={(themeId) => dispatch({ type: 'SET_THEME', themeId })}
      />

      <NoticeCard notice={state.event.notice} onEdit={onOpenSettings} />

      <Text className="poster-tip">
        微信里长按预览图即可保存或转发给好友；点下方按钮可直接存到相册。
      </Text>

      <ActionBar
        primaryLabel={busy ? '保存中…' : '保存到相册'}
        onPrimary={() => void handleSave()}
        primaryDisabled={busy}
        secondaryLabel="返回分组"
        onSecondary={onBack}
        hint={`${data.totalPlayers} 人 · ${data.groups.length} 场 · 后补 ${data.waitlist.length} 人`}
      />
    </View>
  );
}
