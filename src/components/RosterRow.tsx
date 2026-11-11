import { useEffect, useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import type { Player } from '@/types';
import { showRoseBadge } from '@/lib/player';

interface RosterRowProps {
  player: Player;
  index: number;
  onRename: (id: string, name: string) => void;
  onToggleFemale: (id: string) => void;
  onRemove: (id: string) => void;
}

const TONES = 6;

/** 同名首字生成稳定的头像色，避免每次渲染跳色。 */
function toneFor(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  }
  return hash % TONES;
}

function initialFor(name: string): string {
  return Array.from(name.trim())[0] ?? '?';
}

export function RosterRow({
  player,
  index,
  onRename,
  onToggleFemale,
  onRemove,
}: RosterRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.name);

  // 外部改名后同步回草稿，避免再次编辑时显示旧值
  useEffect(() => {
    if (!editing) setDraft(player.name);
  }, [player.name, editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === player.name) {
      setDraft(player.name);
      return;
    }
    onRename(player.id, next);
  };

  return (
    <View className="roster-row">
      <View className={`roster-avatar tone-${toneFor(player.name)}`}>
        <Text className="roster-avatar__text">{initialFor(player.name)}</Text>
      </View>

      <View className="roster-main">
        <Text className="roster-index">{String(index + 1).padStart(2, '0')}</Text>
        {editing ? (
          <Input
            className="roster-input"
            value={draft}
            maxlength={30}
            focus
            confirmType="done"
            onInput={(event) => setDraft(event.detail.value)}
            onBlur={commit}
            onConfirm={commit}
          />
        ) : (
          <View className="roster-name-wrap" onClick={() => setEditing(true)}>
            <Text className="roster-name">{player.name}</Text>
            {showRoseBadge(player.name, player.isFemale) ? (
              <Text className="roster-rose">🌹</Text>
            ) : null}
          </View>
        )}
      </View>

      <View
        className={`roster-gender ${player.isFemale ? 'is-female' : ''}`}
        onClick={() => onToggleFemale(player.id)}
      >
        <Text className="roster-gender__text">
          {player.isFemale ? '女' : '男'}
        </Text>
      </View>

      <View className="roster-remove" onClick={() => onRemove(player.id)}>
        <Text className="roster-remove__text">删</Text>
      </View>
    </View>
  );
}
