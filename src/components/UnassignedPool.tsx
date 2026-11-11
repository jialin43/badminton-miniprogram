import { Text, View } from '@tarojs/components';
import type { Player } from '@/types';
import { PlayerCard } from './PlayerCard';

interface UnassignedPoolProps {
  players: Player[];
  onOpenMove: (playerId: string) => void;
}

/** 后补名单：放还没凑满一场的成员。 */
export function UnassignedPool({ players, onOpenMove }: UnassignedPoolProps) {
  return (
    <View className={`pool ${players.length === 0 ? 'is-empty' : ''}`}>
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
            />
          ))}
        </View>
      ) : (
        <Text className="pool-empty">暂无后补 · 每个场次满 6 人</Text>
      )}
    </View>
  );
}
