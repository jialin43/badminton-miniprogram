import { Text, View } from '@tarojs/components';
import type { Player } from '@/types';
import { showRoseBadge } from '@/lib/player';

type TouchLike = {
  touches?: Array<{ clientX: number; clientY: number }>;
  changedTouches?: Array<{ clientX: number; clientY: number }>;
};

interface PlayerCardProps {
  player: Player;
  index: number;
  onOpenMove: (playerId: string) => void;
  /** 按住并拖动时触发 */
  onDragStart?: (playerId: string, event: TouchLike) => void;
  /** 拖动过程中 */
  onDragMove?: (event: TouchLike) => void;
  /** 松手 */
  onDragEnd?: (event: TouchLike) => void;
  /** 是否正在被拖动（用于半透明占位） */
  dragging?: boolean;
  /** 拖拽悬停在这张卡上：显示“松手即可互换”的高亮 */
  dropOn?: boolean;
}

/**
 * 分组页里的成员卡。
 *
 * 两种交互并存：
 * - 按住拖动 → 拖到其他场次/后补区放下
 * - 轻点 → 弹出“移动到…”面板（走 onOpenMove），
 *   给不习惯拖拽、或目标场次在屏幕外的情况留一条稳的路。
 *
 * 注意：touchmove / touchend 必须绑在这张卡片自身上，不能交给父级冒泡。
 * 手指拖出卡片范围后，小程序会把 touchend 派发给卡片自己的节点，
 * 父节点收不到，拖拽状态就会卡住。
 */
export function PlayerCard({
  player,
  index,
  onOpenMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragging,
  dropOn,
}: PlayerCardProps) {
  return (
    <View
      className={`player-card ${player.isFemale ? 'is-female' : ''} ${
        dragging ? 'is-dragging' : ''
      } ${dropOn ? 'is-drop-on' : ''}`}
      onClick={() => onOpenMove(player.id)}
      onTouchStart={(event) => onDragStart?.(player.id, event as never)}
      onTouchMove={(event) => onDragMove?.(event as never)}
      onTouchEnd={(event) => onDragEnd?.(event as never)}
      onTouchCancel={(event) => onDragEnd?.(event as never)}
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
