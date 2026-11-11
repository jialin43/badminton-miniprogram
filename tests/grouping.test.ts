import { describe, expect, it } from 'vitest';
import {
  autoGroup,
  fillGroups,
  groupCountFor,
  movePlayer,
  nextGroupLabel,
  removePlayerFromLayout,
  swapPlayers,
} from '../src/lib/grouping';
import type { Group, Player } from '../src/types';

function makePlayers(count: number, femaleIndexes: number[] = []): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `球友${index + 1}`,
    isFemale: femaleIndexes.includes(index),
  }));
}

function makeGroups(...sizes: number[]): Group[] {
  let cursor = 1;
  return sizes.map((size, index) => {
    const ids = Array.from({ length: size }, () => `p${cursor++}`);
    return {
      id: `g${index + 1}`,
      label: `${String.fromCharCode(65 + index)}组`,
      playerIds: ids,
    };
  });
}

describe('autoGroup', () => {
  it('12 人分成 2 组，每组 6 人', () => {
    const result = autoGroup(makePlayers(12), 6);

    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(result.unassignedIds).toEqual([]);
  });

  it('13 人分成 2 个满员场次，余下 1 人进入后补', () => {
    const result = autoGroup(makePlayers(13), 6);

    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(result.unassignedIds).toHaveLength(1);
  });

  it('7 人分成 1 个满员场次，余下 1 人进入后补', () => {
    const result = autoGroup(makePlayers(7), 6);

    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6]);
    expect(result.unassignedIds).toHaveLength(1);
  });

  it('不足 6 人时不建场次，全部进入后补', () => {
    const result = autoGroup(makePlayers(5), 6);

    expect(result.groups).toHaveLength(0);
    expect(result.unassignedIds).toHaveLength(5);
  });

  it('保留已有小组的 id 和自定义名称', () => {
    const result = autoGroup(makePlayers(12), 6, [
      { id: 'keep-a', label: '1号场', playerIds: [] },
      { id: 'keep-b', label: '2号场', playerIds: [] },
    ]);

    expect(result.groups.map((group) => group.id)).toEqual(['keep-a', 'keep-b']);
    expect(result.groups.map((group) => group.label)).toEqual(['1号场', '2号场']);
  });

  it('女生分散时每组女生数量尽量均衡', () => {
    const players = makePlayers(12, [0, 1, 2, 3]);
    const result = autoGroup(players, 6, [], {
      spreadWomen: true,
      rng: () => 0.5,
    });

    const femaleByGroup = result.groups.map((group) =>
      group.playerIds.filter((id) => players.find((player) => player.id === id)?.isFemale),
    );

    expect(femaleByGroup.map((ids) => ids.length)).toEqual([2, 2]);
    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
  });

  it('空名单返回空分组', () => {
    expect(autoGroup([], 6)).toEqual({ groups: [], unassignedIds: [] });
  });

  it('groupCountFor 只计算满员场次', () => {
    expect(groupCountFor(0)).toBe(0);
    expect(groupCountFor(1)).toBe(0);
    expect(groupCountFor(5)).toBe(0);
    expect(groupCountFor(6)).toBe(1);
    expect(groupCountFor(7)).toBe(1);
    expect(groupCountFor(12)).toBe(2);
    expect(groupCountFor(13)).toBe(2);
  });
});

describe('fillGroups（随机分组只补后补区）', () => {
  it('已有满员场次保持不变，只把后补区补进空位', () => {
    const players = makePlayers(14);
    const groups: Group[] = [
      { id: 'g1', label: 'A组', playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    ];
    const pool = players.slice(6).map((player) => player.id);

    const result = fillGroups(players, groups, pool, 6, { rng: () => 0.5 });

    expect(result.groups[0]?.playerIds).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ]);
    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(result.unassignedIds).toHaveLength(2);
    expect(result.filledGroups).toBe(2);
    expect(result.movedCount).toBe(6);
  });

  it('手动拖好的分组不会被补齐操作冲掉', () => {
    const players = makePlayers(13);
    const groups: Group[] = [
      { id: 'manual', label: '1号场', playerIds: ['p9', 'p10', 'p11', 'p12', 'p13', 'p1'] },
    ];

    const result = fillGroups(players, groups, ['p2', 'p3'], 6, {
      shuffle: true,
      rng: () => 0.5,
    });

    expect(result.groups[0]?.id).toBe('manual');
    expect(result.groups[0]?.label).toBe('1号场');
    expect(result.groups[0]?.playerIds).toContain('p9');
    expect(result.groups[0]?.playerIds).toHaveLength(6);
  });

  it('后补人数不够一场时不会创建残缺场次', () => {
    const players = makePlayers(8);

    const result = fillGroups(players, [], players.map((player) => player.id), 6);

    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6]);
    expect(result.unassignedIds).toHaveLength(2);
  });

  it('不足 6 人时一个人也不放进场次', () => {
    const players = makePlayers(5);

    const result = fillGroups(players, [], players.map((player) => player.id), 6);

    expect(result.groups).toHaveLength(0);
    expect(result.unassignedIds).toHaveLength(5);
  });

  it('后补区按报名顺序保留，多余的人留在后补', () => {
    const players = makePlayers(16);
    const groups: Group[] = [
      { id: 'g1', label: 'A组', playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    ];
    const pool = players.slice(6).map((player) => player.id);

    const result = fillGroups(players, groups, pool, 6, { rng: () => 0.5 });

    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    // 12 个名额用完全部名额后剩余 4 人，顺序与报名顺序一致
    expect(result.unassignedIds).toEqual(['p13', 'p14', 'p15', 'p16']);
  });
});

describe('movePlayer', () => {
  it('跨组移动后成员只出现一次', () => {
    const groups = makeGroups(5, 5);
    const result = movePlayer(groups, [], 'p1', 'g2');

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds).toHaveLength(4);
    expect(result.groups[1]?.playerIds).toHaveLength(6);
    const all = result.groups.flatMap((group) => group.playerIds);
    expect(all.filter((id) => id === 'p1')).toHaveLength(1);
  });

  it('目标组已满时拒绝放入', () => {
    const groups = makeGroups(6, 6);
    const result = movePlayer(groups, [], 'p1', 'g2');

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('full');
    expect(result.groups[0]?.playerIds).toHaveLength(6);
    expect(result.groups[1]?.playerIds).toHaveLength(6);
  });

  it('从满员组移出到另一个满员组时，先移除再判断目标容量', () => {
    const groups = makeGroups(6, 6);
    const result = movePlayer(groups, [], 'p1', 'g2');

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('full');
  });

  it('组内排序', () => {
    const groups = makeGroups(6);
    const result = movePlayer(groups, [], 'p1', 'g1', 3);

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds).toEqual([
      'p2',
      'p3',
      'p1',
      'p4',
      'p5',
      'p6',
    ]);
  });

  it('拖到原位置不产生变更', () => {
    const groups = makeGroups(6);
    const result = movePlayer(groups, [], 'p1', 'g1', 0);

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('noop');
  });

  it('可以移动到待分组池并指定顺序', () => {
    const groups = makeGroups(3);
    const result = movePlayer(groups, ['p9'], 'p1', null, 1);

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds).toEqual(['p2', 'p3']);
    expect(result.unassignedIds).toEqual(['p9', 'p1']);
  });

  it('找不到成员时返回 missing', () => {
    const result = movePlayer(makeGroups(3), [], 'nope', 'g1');
    expect(result.changed).toBe(false);
    expect(result.reason).toBe('missing');
  });
});

describe('swapPlayers（跨组互换）', () => {
  it('A 组与 B 组互换两人，人数和 id 集合都不变', () => {
    const groups = makeGroups(6, 6);
    const result = swapPlayers(groups, [], 'p1', 'p8');

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds[0]).toBe('p8');
    expect(result.groups[1]?.playerIds[1]).toBe('p1');
    expect(result.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);

    const all = result.groups.flatMap((group) => group.playerIds).sort();
    const original = groups.flatMap((group) => group.playerIds).sort();
    expect(all).toEqual(original);
  });

  it('与原小组互换：5 人和 6 人的场次互换后人数不变', () => {
    const groups = makeGroups(5, 6);
    const result = swapPlayers(groups, [], 'p1', 'p7');

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds).toHaveLength(5);
    expect(result.groups[1]?.playerIds).toHaveLength(6);
    expect(result.groups[0]?.playerIds).toContain('p7');
    expect(result.groups[1]?.playerIds).toContain('p1');
  });

  it('与后补名单互换', () => {
    const groups = makeGroups(6);
    const result = swapPlayers(groups, ['p99', 'p98'], 'p1', 'p98');

    expect(result.changed).toBe(true);
    expect(result.groups[0]?.playerIds).toHaveLength(6);
    expect(result.groups[0]?.playerIds).toContain('p98');
    expect(result.unassignedIds).toEqual(['p99', 'p1']);
  });

  it('拖到自己身上或同组内不做互换', () => {
    const groups = makeGroups(6, 6);

    expect(swapPlayers(groups, [], 'p1', 'p1').reason).toBe('noop');
    expect(swapPlayers(groups, [], 'p1', 'p3').reason).toBe('noop');
  });

  it('找不到成员时返回 missing', () => {
    const result = swapPlayers(makeGroups(6, 6), [], 'p1', 'nope');
    expect(result.changed).toBe(false);
    expect(result.reason).toBe('missing');
  });

  it('互换不会产生重复或丢失成员', () => {
    const groups = makeGroups(6, 6, 6);
    const result = swapPlayers(groups, [], 'p1', 'p18');

    const all = result.groups.flatMap((group) => group.playerIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(18);
  });
});

describe('layout helpers', () => {
  it('删除成员后清理所有分组引用', () => {
    const groups = makeGroups(3, 3);
    const result = removePlayerFromLayout(groups, ['p1'], 'p2');

    expect(result.groups[0]?.playerIds).toEqual(['p1', 'p3']);
    expect(result.groups[1]?.playerIds).not.toContain('p2');
    expect(result.unassignedIds).toEqual(['p1']);
  });

  it('nextGroupLabel 跳过已使用标签', () => {
    expect(nextGroupLabel([])).toBe('A组');
    expect(nextGroupLabel([{ id: 'a', label: 'A组', playerIds: [] }])).toBe('B组');
    expect(nextGroupLabel([{ id: 'a', label: 'A组', playerIds: [] }, { id: 'b', label: 'C组', playerIds: [] }])).toBe('B组');
  });
});
