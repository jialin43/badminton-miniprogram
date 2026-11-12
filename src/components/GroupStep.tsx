import { useMemo, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import type { AppState, Player } from '@/types';
import type { AppAction } from '@/state/reducer';
import { formatFullCN, formatTimeRange } from '@/lib/date';
import { groupCountFor, locatePlayer } from '@/lib/grouping';
import { useDragDrop } from '@/hooks/useDragDrop';
import type { DropTarget } from '@/hooks/useDragDrop';
import { ActionBar } from './ActionBar';
import { useConfirm, useToast } from './Feedback';
import { GroupCard } from './GroupCard';
import type { DragHandlers } from './GroupCard';
import { Icon } from './Icon';
import { MoveSheet } from './MoveSheet';
import { NoticeCard } from './NoticeCard';
import { UnassignedPool } from './UnassignedPool';

interface GroupStepProps {
  state: AppState;
  dispatch: (action: AppAction) => void;
  onBack: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  /** 通知父级：正在拖拽，需要暂停列表滚动 */
  onDraggingChange?: (dragging: boolean) => void;
}

export function GroupStep({
  state,
  dispatch,
  onBack,
  onNext,
  onOpenSettings,
  onDraggingChange,
}: GroupStepProps) {
  const notify = useToast();
  const confirm = useConfirm();
  const [movePlayerId, setMovePlayerId] = useState<string | null>(null);

  const playerMap = useMemo(
    () => new Map(state.players.map((player) => [player.id, player])),
    [state.players],
  );

  const fullGroups = state.groups.filter(
    (group) => group.playerIds.length === state.capacity,
  );
  const incompleteGroups = state.groups.filter(
    (group) => group.playerIds.length > 0 && group.playerIds.length < state.capacity,
  );
  const emptyGroups = state.groups.filter((group) => group.playerIds.length === 0);

  const waitlistPlayers = state.unassignedIds
    .map((id) => playerMap.get(id))
    .filter((player): player is Player => Boolean(player));

  /**
   * 随机分组：只把后补名单补进空位。
   * 手动排好的满员场次不会被冲掉。
   */
  const handleFillGroups = () => {
    if (state.players.length === 0) return;

    const targetGroups = groupCountFor(state.players.length, state.capacity);
    if (targetGroups === 0) {
      notify(`不足 ${state.capacity} 人，先留在后补名单`);
      return;
    }

    if (state.unassignedIds.length === 0) {
      notify('后补名单是空的，没有可以补进来的人');
      return;
    }

    dispatch({ type: 'FILL_GROUPS' });
    notify('已按顺序补进空位');
  };

  /** 全部重排：清空现有场次重新分组，需要二次确认。 */
  const handleReshuffleAll = async () => {
    if (state.players.length === 0) return;

    const targetGroups = groupCountFor(state.players.length, state.capacity);
    if (targetGroups === 0) {
      notify(`不足 ${state.capacity} 人，暂时凑不成一场`);
      return;
    }

    const rest = state.players.length - targetGroups * state.capacity;
    const ok = await confirm({
      title: '全部重新分组？',
      message: `会清空当前场次，把 ${state.players.length} 人重新分成 ${targetGroups} 个满员场次，多出的 ${rest} 人进后补（可撤销）。`,
      confirmLabel: '全部重排',
      danger: true,
    });
    if (!ok) return;

    dispatch({ type: 'AUTO_GROUP', shuffle: true });
    notify(`已重新分成 ${targetGroups} 个满员场次`);
  };

  const handleUndo = () => {
    if (state.past.length === 0) {
      notify('还没有可以撤销的操作');
      return;
    }
    dispatch({ type: 'UNDO' });
    notify('已撤销上一步');
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: '清空所有场次？',
      message: '所有成员会回到后补名单，名单和活动信息会保留。此操作可撤销。',
      confirmLabel: '清空场次',
      danger: true,
    });
    if (!ok) return;

    dispatch({ type: 'CLEAR_GROUPS' });
    notify('已清空场次，成员回到后补名单');
  };

  const handleAddGroup = () => {
    if (state.groups.length >= 24) {
      notify('最多支持 24 个场次');
      return;
    }
    dispatch({ type: 'ADD_GROUP' });
    notify('已添加一个空场次');
  };

  const handleRemoveGroup = (id: string) => {
    const group = state.groups.find((entry) => entry.id === id);
    if (!group || group.playerIds.length > 0) return;
    dispatch({ type: 'REMOVE_GROUP', id });
    notify(`已删除 ${group.label}`);
  };

  const handleMove = (playerId: string, targetGroupId: string | null) => {
    const target = targetGroupId
      ? state.groups.find((group) => group.id === targetGroupId)
      : null;
    dispatch({ type: 'MOVE_PLAYER', playerId, targetGroupId });
    notify(target ? `已移动到 ${target.label}` : '已移入后补名单');
  };

  const handleSwap = (playerId: string, targetPlayerId: string) => {
    dispatch({ type: 'SWAP_PLAYER', sourceId: playerId, targetId: targetPlayerId });
    const source = playerMap.get(playerId)?.name ?? '';
    const target = playerMap.get(targetPlayerId)?.name ?? '';
    notify(`${source} 与 ${target} 已互换`);
  };

  /**
   * 拖拽：松手时把成员移动到落点场次 / 后补区。
   *
   * 目标场次已满时自动改为“与场末成员互换”，
   * 这样把 A 组的人拖到满员的 B 组也有确定结果，不用再点面板。
   */
  const handleDrop = (playerId: string, target: DropTarget) => {
    const player = playerMap.get(playerId);
    if (!player) return;

    const from = locatePlayer(state.groups, state.unassignedIds, playerId);

    // ① 落在某个具体成员身上 → 与这个人互换
    if (target.playerId && target.playerId !== playerId) {
      const mate = playerMap.get(target.playerId);
      if (!mate) return;

      const mateLoc = locatePlayer(
        state.groups,
        state.unassignedIds,
        target.playerId,
      );

      // 同场次内互换位置没有意义，给个明确提示，别让用户以为拖失败了
      if (mateLoc && from && mateLoc.groupId === from.groupId) {
        notify(`同一场次内不用互换，换到别的场次才有意义`);
        return;
      }

      dispatch({
        type: 'SWAP_PLAYER',
        sourceId: playerId,
        targetId: target.playerId,
      });
      notify(`${player.name} 与 ${mate.name} 已互换`);
      return;
    }

    // ② 落在场次空白处 / 后补区
    if (from && from.groupId === target.groupId) return;

    if (target.groupId === null) {
      dispatch({ type: 'MOVE_PLAYER', playerId, targetGroupId: null });
      notify(`${player.name} 已移入后补名单`);
      return;
    }

    const group = state.groups.find((entry) => entry.id === target.groupId);
    if (!group) return;

    if (group.playerIds.length >= state.capacity) {
      // 已满且没点中具体的人：退化为与场末成员互换，避免“拖过去没反应”
      const mateId = group.playerIds[group.playerIds.length - 1];
      if (!mateId || mateId === playerId) return;

      dispatch({ type: 'SWAP_PLAYER', sourceId: playerId, targetId: mateId });
      const mate = playerMap.get(mateId)?.name ?? '';
      notify(`${player.name} 与 ${mate} 已互换`);
      return;
    }

    dispatch({ type: 'MOVE_PLAYER', playerId, targetGroupId: group.id });
    notify(`${player.name} 已移动到 ${group.label}`);
  };

  const { drag, startDrag, moveDrag, endDrag } = useDragDrop({
    onDrop: handleDrop,
    onDraggingChange,
    // 顺序必须与页面渲染顺序完全一致：
    // 先后补区成员，再各场次成员，用于把量到的矩形映射回具体的人
    layout: {
      waitlistIds: state.unassignedIds,
      groups: state.groups.map((group) => ({
        id: group.id,
        playerIds: group.playerIds,
      })),
    },
    // 拖拽起不来时（例如落点量不到），退回点按移动，别让用户卡住
    onFallback: setMovePlayerId,
  });

  // 透传给每张成员卡：touchmove/touchend 必须绑在卡片自身，靠父级冒泡会丢
  const dragHandlers: DragHandlers = {
    onDragStart: startDrag,
    onDragMove: moveDrag,
    onDragEnd: endDrag,
  };

  const dragPlayer = drag ? playerMap.get(drag.playerId) ?? null : null;

  const handleNext = async () => {
    if (fullGroups.length === 0) {
      notify(`还没有满 ${state.capacity} 人的场次，先凑满一场再生成`);
      return;
    }

    if (incompleteGroups.length > 0) {
      const moved = incompleteGroups.reduce(
        (total, group) => total + group.playerIds.length,
        0,
      );
      const ok = await confirm({
        title: '有场次未满 6 人',
        message: `${incompleteGroups.length} 个场次未满 ${state.capacity} 人，生成海报前会把其中 ${moved} 人移入后补名单。`,
        confirmLabel: '移入后补',
      });
      if (!ok) return;
    }

    if (incompleteGroups.length > 0 || emptyGroups.length > 0) {
      dispatch({ type: 'NORMALIZE_GROUPS' });
    }

    dispatch({ type: 'SET_STEP', step: 3 });
    onNext();
  };

  return (
    <View
      className={`page-content page-content--with-bar ${
        drag ? 'is-drag-active' : ''
      }`}
    >
      <View className="event-strip">
        <View className="event-main">
          <Text className="section-kicker">MATCH INFO</Text>
          <Text className="event-date">
            {formatFullCN(state.event.date)} ·{' '}
            {formatTimeRange(state.event.startTime, state.event.endTime)}
          </Text>
          <Text className="event-venue">{state.event.venue || '场地待定'}</Text>
        </View>
        <Button className="btn btn--sm btn--ghost" onClick={onOpenSettings}>
          <Icon name="edit" size={20} />
          编辑
        </Button>
      </View>

      <View className="stats">
        <View className="stat">
          <Text className="stat__value">{state.players.length}</Text>
          <Text className="stat__label">总人数</Text>
        </View>
        <View className="stat">
          <Text className="stat__value">{fullGroups.length}</Text>
          <Text className="stat__label">满员场次</Text>
        </View>
        <View className="stat">
          <Text className="stat__value">{waitlistPlayers.length}</Text>
          <Text className="stat__label">后补</Text>
        </View>
      </View>

      <View className="toolbar">
        <Button
          className={`tool-button tool-button--primary ${
            state.unassignedIds.length === 0 ? 'tool-button--disabled' : ''
          }`}
          disabled={state.unassignedIds.length === 0}
          onClick={handleFillGroups}
        >
          <Icon name="shuffle" size={22} />
          随机分组
        </Button>
        <Button className="tool-button" onClick={() => void handleReshuffleAll()}>
          <Icon name="refresh" size={22} />
          全部重排
        </Button>
        <Button
          className={`tool-button ${
            state.past.length === 0 ? 'tool-button--disabled' : ''
          }`}
          disabled={state.past.length === 0}
          onClick={handleUndo}
        >
          <Icon name="undo" size={22} />
          撤销
        </Button>
        <Button
          className="tool-button tool-button--danger"
          onClick={() => void handleClear()}
        >
          <Icon name="trash" size={22} />
          清空
        </Button>
      </View>

      <UnassignedPool
        players={waitlistPlayers}
        onOpenMove={setMovePlayerId}
        dragHandlers={dragHandlers}
        draggingId={drag?.playerId ?? null}
        // 命中具体成员时只高亮那一张卡，不再整块高亮，避免视觉噪音
        dropActive={
          drag?.over?.groupId === null && !drag?.over?.playerId
        }
        dropOnPlayerId={
          drag?.over?.groupId === null ? (drag.over.playerId ?? null) : null
        }
      />

      <View className="groups-list">
        {state.groups.map((group) => {
          const players = group.playerIds
            .map((id) => playerMap.get(id))
            .filter((player): player is Player => Boolean(player));

          return (
            <GroupCard
              key={group.id}
              group={group}
              players={players}
              capacity={state.capacity}
              onOpenMove={setMovePlayerId}
              onRename={(id, label) =>
                dispatch({ type: 'RENAME_GROUP', id, label })
              }
              onRemove={handleRemoveGroup}
              dragHandlers={dragHandlers}
              draggingId={drag?.playerId ?? null}
              dropActive={
                drag?.over?.groupId === group.id && !drag?.over?.playerId
              }
              dropOnPlayerId={
                drag?.over?.groupId === group.id
                  ? (drag.over.playerId ?? null)
                  : null
              }
            />
          );
        })}
      </View>

      {state.groups.length === 0 ? (
        <View className="empty">
          <Text className="empty__title">还没有场次</Text>
          <Text className="empty__text">
            点“添加场次”后把人挪进去，或点“随机分组”自动凑满；没凑满 6
            人的会留在后补名单。
          </Text>
        </View>
      ) : null}

      <Button className="btn btn--ghost btn--block add-group-btn" onClick={handleAddGroup}>
        <Icon name="plus" size={24} />
        添加场次
      </Button>

      <Text className="drag-tip">
        点成员卡片可移动到其他场次，或与已满场次的人互换位置
      </Text>

      <NoticeCard notice={state.event.notice} onEdit={onOpenSettings} />

      <MoveSheet
        open={movePlayerId !== null}
        playerId={movePlayerId}
        state={state}
        onClose={() => setMovePlayerId(null)}
        onMove={handleMove}
        onSwapWith={handleSwap}
      />

      {/*
       * 拖拽接管层。
       *
       * 手指一抬起就渲染，覆盖整个屏幕，吃掉后续所有 touch 事件：
       * - catchtouchmove 阻止 ScrollView 接管滚动（否则拖拽会被吞掉）
       * - touchend 在这里一定能收到，不依赖卡片节点是否还在
       * 这一层只在拖拽期间存在，不拖拽时完全不渲染，不影响正常滚动。
       */}
      {drag ? (
        <View
          className="drag-layer"
          onTouchMove={moveDrag as never}
          onTouchEnd={endDrag as never}
          onTouchCancel={endDrag as never}
          catchMove
        >
          <View
            className="drag-ghost"
            style={{
              left: `${drag.x}px`,
              top: `${drag.y}px`,
            }}
          >
            <Text className="drag-ghost__name">
              {dragPlayer?.name ?? ''}
            </Text>
          </View>
        </View>
      ) : null}

      <ActionBar
        primaryLabel="生成海报"
        onPrimary={() => void handleNext()}
        primaryDisabled={fullGroups.length === 0}
        secondaryLabel="返回名单"
        onSecondary={onBack}
        hint={
          fullGroups.length === 0
            ? state.groups.length === 0
              ? '点“随机分组”自动凑满，或添加场次后移入 6 人'
              : `还没有满 ${state.capacity} 人的场次`
            : incompleteGroups.length > 0
              ? `${incompleteGroups.length} 个场次未满，生成前会移入后补`
              : waitlistPlayers.length > 0
                ? `${waitlistPlayers.length} 人进入后补名单，可继续生成`
                : `${state.players.length} 人 · ${fullGroups.length} 场`
        }
      />
    </View>
  );
}
