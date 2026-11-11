import { Button, Text, View } from '@tarojs/components';
import { locatePlayer } from '@/lib/grouping';
import { showRoseBadge } from '@/lib/player';
import type { AppState } from '@/types';
import { Sheet } from './Sheet';

interface MoveSheetProps {
  open: boolean;
  playerId: string | null;
  state: AppState;
  onClose: () => void;
  onMove: (playerId: string, targetGroupId: string | null) => void;
  onSwapWith: (playerId: string, targetPlayerId: string) => void;
}

/**
 * 点按成员后的“移动到…”面板。
 *
 * 小程序版用它取代拖拽：
 * - 点目标场次 → 移入该场次
 * - 点“与某人互换” → 选择另一位成员互换位置
 * 这样互换成组依然可达，而且不依赖手势。
 */
export function MoveSheet({
  open,
  playerId,
  state,
  onClose,
  onMove,
  onSwapWith,
}: MoveSheetProps) {
  const player = state.players.find((entry) => entry.id === playerId) ?? null;
  const location =
    player && playerId
      ? locatePlayer(state.groups, state.unassignedIds, playerId)
      : null;

  const currentGroup = location?.groupId
    ? state.groups.find((group) => group.id === location.groupId)
    : null;

  return (
    <Sheet
      open={open && Boolean(player)}
      onClose={onClose}
      title="移动到…"
      subtitle={
        player
          ? `${player.name}${
              showRoseBadge(player.name, player.isFemale) ? ' 🌹' : ''
            } · 当前在${currentGroup?.label ?? '后补名单'}`
          : undefined
      }
    >
      {player ? (
        <View className="move-sheet">
          <Text className="move-tip">
            选一个场次移入，或与该场次的人互换位置。
          </Text>

          {state.groups.map((group) => {
            const isCurrent = group.id === location?.groupId;
            const isFull = group.playerIds.length >= state.capacity;

            return (
              <View className="move-group" key={group.id}>
                <Button
                  className={`move-option ${
                    isCurrent ? 'is-current' : ''
                  } ${isFull && !isCurrent ? 'is-full' : ''}`}
                  disabled={isCurrent}
                  onClick={() => {
                    onMove(player.id, group.id);
                    onClose();
                  }}
                >
                  <View className="move-option-main">
                    <Text className="move-option-label">{group.label}</Text>
                    <Text className="move-option-hint">
                      {isCurrent
                        ? '当前所在场次'
                        : isFull
                          ? '已满 · 可互换'
                          : '可加入'}
                    </Text>
                  </View>
                  <Text className="move-option-count">
                    {group.playerIds.length}/{state.capacity}
                  </Text>
                </Button>

                {/* 已满的场次才展开互换人选，避免面板过长 */}
                {isFull && !isCurrent ? (
                  <View className="swap-list">
                    {group.playerIds.map((id) => {
                      const mate = state.players.find((p) => p.id === id);
                      if (!mate) return null;
                      return (
                        <View
                          className="swap-chip"
                          key={id}
                          onClick={() => {
                            onSwapWith(player.id, id);
                            onClose();
                          }}
                        >
                          <Text className="swap-chip__text">
                            {mate.name}
                            {showRoseBadge(mate.name, mate.isFemale) ? ' 🌹' : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}

          {state.groups.length === 0 ? (
            <Text className="move-empty">还没有场次，先添加一个吧。</Text>
          ) : null}

          {location?.groupId ? (
            <Button
              className="btn btn--soft btn--block"
              onClick={() => {
                onMove(player.id, null);
                onClose();
              }}
            >
              移出小组，放到后补名单
            </Button>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
