import { Text, View } from '@tarojs/components';
import type { Player } from '@/types';
import type { DragHandlers } from './GroupCard';
import { PlayerCard } from './PlayerCard';

interface UnassignedPoolProps {
  players: Player[];
  onOpenMove: (playerId: string) => void;
  dragHandlers?: DragHandlers;
  draggingId?: string | null;
  /** 当前拖拽悬停在后补区上 */
  dropActive?: boolean;
  /** 当前拖拽精确悬停的成员 id */
  dropOnPlayerId?: string | null;
}

/** 后补名单：放还没凑满一场的成员。也是拖拽的落点之一。 */
export function UnassignedPool({
  players,
  onOpenMove,
  dragHandlers,
  draggingId,
  dropActive,
  dropOnPlayerId,
}: UnassignedPoolProps) {
  return (
    <View
      className={`pool ${players.length === 0 ? 'is-empty' : ''} ${
        dropActive ? 'is-drop-target' : ''
      }`}
    >
      <View className="pool-head">
        <View className="pool-title">
          <Text className="pool-title__text">后补名单</Text>
          <Text className="pool-count">{players.length}</Text>
        </View>
      </View>

      {players.length > 0 ? (
        <View className="pool-grid">
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              index={index}
              onOpenMove={onOpenMove}
              dragging={draggingId === player.id}
              dropOn={dropOnPlayerId === player.id}
              onDragStart={dragHandlers?.onDragStart}
              onDragMove={dragHandlers?.onDragMove}
              onDragEnd={dragHandlers?.onDragEnd}
            />
          ))}
        </View>
      ) : (
        <Text className="pool-empty">暂无后补 · 每个场次满 6 人</Text>
      )}
    </View>
  );
}
