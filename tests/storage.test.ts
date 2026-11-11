import { describe, expect, it } from 'vitest';
import { hydrateState } from '../src/lib/storage';

function rawState(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    step: 2,
    rawText: '1. 阿哲',
    players: [
      { id: 'p1', name: '阿哲', isFemale: false },
      { id: 'p2', name: '小满🌹', isFemale: true },
      { id: 'p3', name: 'Momo', isFemale: false },
    ],
    groups: [
      { id: 'g1', label: 'A组', playerIds: ['p1', 'p2'] },
      { id: 'g2', label: 'B组', playerIds: ['p2', 'p3'] },
    ],
    unassignedIds: ['p3'],
    event: {
      title: '测试活动',
      date: '2026-10-29',
      startTime: '19:00',
      endTime: '21:00',
      venue: '测试球馆',
    },
    capacity: 6,
    report: null,
    updatedAt: 1,
    ...overrides,
  };
}

describe('hydrateState', () => {
  it('修复重复分组引用和待分组重复项', () => {
    const state = hydrateState(rawState());

    expect(state).not.toBeNull();
    expect(state!.groups[0]!.playerIds).toEqual(['p1', 'p2']);
    expect(state!.groups[1]!.playerIds).toEqual(['p3']);
    expect(state!.unassignedIds).toEqual([]);
    expect(state!.players[1]!.name).toBe('小满');
  });

  it('超过容量时把多出的成员移回待分组', () => {
    const players = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `球友${index + 1}`,
      isFemale: false,
    }));
    const state = hydrateState(
      rawState({
        players,
        groups: [
          {
            id: 'g1',
            label: 'A组',
            playerIds: players.map((player) => player.id),
          },
        ],
        unassignedIds: [],
      }),
    );

    expect(state!.groups[0]!.playerIds).toHaveLength(6);
    expect(state!.unassignedIds).toHaveLength(2);
  });

  it('没有小组时不允许恢复到第三步', () => {
    const state = hydrateState(rawState({ groups: [], step: 3 }));
    expect(state!.step).toBe(1);
  });

  it('无效日期和非法时间会回退到默认值', () => {
    const state = hydrateState(
      rawState({
        event: {
          title: '',
          date: '2026-02-31',
          startTime: '25:00',
          endTime: '01:00',
          venue: '',
        },
      }),
    );

    expect(state!.event.title).toBe('本周羽毛球分组');
    expect(state!.event.startTime).toBe('19:00');
    expect(state!.event.endTime).toBe('21:00');
    expect(state!.event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state!.event.notice).toBe(
      '两上两下，合理串场，不允许打架，停车免费。',
    );
  });

  it('完全无效的数据返回 null', () => {
    expect(hydrateState(null)).toBeNull();
    expect(hydrateState('nope')).toBeNull();
  });
});
