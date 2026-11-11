import { Text, View, Input } from '@tarojs/components';
import { useState } from 'react';
import type { Group, Player } from '@/types';
import { PlayerCard } from './PlayerCard';

interface GroupCardProps {
  group: Group;
  players: Player[];
  capacity: number;
  onOpenMove: (playerId: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export function GroupCard({
  group,
  players,
  capacity,
  onOpenMove,
  onRename,
  onRemove,
}: GroupCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);

  const isFull = players.length >= capacity;
  const isIncomplete = players.length > 0 && players.length < capacity;
  const isEmpty = players.length === 0;

  const commitRename = () => {
    const next = draft.trim().slice(0, 12);
    setEditing(false);
    if (!next || next === group.label) {
      setDraft(group.label);
      return;
    }
    onRename(group.id, next);
  };

  return (
    <View
      className={`group-card ${isFull ? 'is-full' : ''} ${
        isIncomplete ? 'is-incomplete' : ''
      }`}
    >
      <View className="group-head">
        <View className="group-title-wrap">
          <View className="group-mark" />
          {editing ? (
            <Input
              className="group-label-input"
              value={draft}
              maxlength={12}
              focus
              confirmType="done"
              onInput={(event) => setDraft(event.detail.value)}
              onBlur={commitRename}
              onConfirm={commitRename}
            />
          ) : (
            <Text className="group-title" onClick={() => setEditing(true)}>
              {group.label}
            </Text>
          )}
        </View>

        <View className="group-head-right">
          {isIncomplete ? <Text className="badge badge--warn">未满</Text> : null}
          <Text className={`count-pill ${isFull ? 'is-full' : ''}`}>
            {players.length}/{capacity}
          </Text>
          {isEmpty ? (
            <View className="group-remove" onClick={() => onRemove(group.id)}>
              <Text className="group-remove__text">删</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="player-grid">
        {Array.from({ length: capacity }).map((_, index) => {
          const player = players[index];
          return player ? (
            <PlayerCard
              key={player.id}
              player={player}
              index={index}
              onOpenMove={onOpenMove}
            />
          ) : (
            <View className="empty-slot" key={`empty-${index}`}>
              <Text className="empty-slot__text">空位</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
