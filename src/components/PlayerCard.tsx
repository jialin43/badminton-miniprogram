import { Text, View } from '@tarojs/components';
import type { Player } from '@/types';
import { showRoseBadge } from '@/lib/player';

interface PlayerCardProps {
  player: Player;
  index: number;
  onOpenMove: (playerId: string) => void;
}

/**
 * 分组页里的成员卡。
 *
 * 小程序版去掉了拖拽把手，点整张卡片唤起“移动到…”面板，
 * 交互更简单，也不会和页面滚动冲突。
 */
export function PlayerCard({ player, index, onOpenMove }: PlayerCardProps) {
  return (
    <View
      className={`player-card ${player.isFemale ? 'is-female' : ''}`}
      onClick={() => onOpenMove(player.id)}
      hoverClass="player-card--hover"
    >
      <Text className="player-order">{String(index + 1).padStart(2, '0')}</Text>
      <Text className="player-name">{player.name}</Text>
      {showRoseBadge(player.name, player.isFemale) ? (
        <Text className="player-rose">🌹</Text>
      ) : null}
    </View>
  );
}
