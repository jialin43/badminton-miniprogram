import { describe, expect, it } from 'vitest';
import { appReducer, createInitialState } from '../src/state/reducer';
import type { AppState, ImportReport, ParsedPlayerDraft } from '../src/types';

function drafts(count: number, female: number[] = []): ParsedPlayerDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `球友${index + 1}`,
    isFemale: female.includes(index),
    sourceLine: index + 2,
  }));
}

function report(): ImportReport {
  return {
    mode: 'numbered',
    duplicates: [],
    ignored: [],
    parsedAt: 1,
  };
}

function withRoster(count: number, female: number[] = []): AppState {
  return appReducer(createInitialState(), {
    type: 'SET_ROSTER',
    drafts: drafts(count, female),
    report: report(),
  });
}

function withGroupedRoster(count: number, female: number[] = []): AppState {
  return appReducer(withRoster(count, female), {
    type: 'AUTO_GROUP',
    shuffle: false,
  });
}

describe('appReducer', () => {
  it('导入后默认按接龙顺序分组，满 6 人成一场', () => {
    const state = withRoster(12, [0, 1]);

    expect(state.players).toHaveLength(12);
    expect(state.groups).toHaveLength(2);
    expect(state.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(state.unassignedIds).toHaveLength(0);
  });

  it('默认分组时余下不足 6 人进入后补', () => {
    const state = withRoster(14);

    expect(state.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(state.unassignedIds).toHaveLength(2);
  });

  it('识别结果会带出空场馆和默认时间', () => {
    const state = appReducer(createInitialState(), {
      type: 'SET_ROSTER',
      drafts: drafts(2),
      report: report(),
      hints: {
        date: '2026-11-05',
        startTime: '20:00',
        endTime: '22:00',
        venue: '星光羽毛球馆',
      },
    });

    expect(state.event.venue).toBe('星光羽毛球馆');
    expect(state.event.startTime).toBe('20:00');
    expect(state.event.endTime).toBe('22:00');
    expect(state.event.date).toBe('2026-11-05');
  });

  it('随机分组可以撤销', () => {
    const state = withRoster(13);
    const regrouped = appReducer(state, { type: 'AUTO_GROUP', shuffle: true });

    expect(regrouped.past).toHaveLength(1);
    expect(regrouped.groups.map((group) => group.playerIds.length)).toEqual([
      6, 6,
    ]);
    expect(regrouped.unassignedIds).toHaveLength(1);

    const undone = appReducer(regrouped, { type: 'UNDO' });
    expect(undone.groups).toEqual(state.groups);
    expect(undone.unassignedIds).toEqual(state.unassignedIds);
  });

  it('清空分组会保留名单并全部移入后补', () => {
    const state = withGroupedRoster(7);
    const cleared = appReducer(state, { type: 'CLEAR_GROUPS' });

    expect(cleared.players).toHaveLength(7);
    expect(cleared.unassignedIds).toHaveLength(7);
    expect(cleared.groups.every((group) => group.playerIds.length === 0)).toBe(true);

    const undone = appReducer(cleared, { type: 'UNDO' });
    expect(undone.groups).toEqual(state.groups);
  });

  it('移动成员到已满场次时 reducer 保持原状', () => {
    const state = withGroupedRoster(12);
    const fullTarget = state.groups[1]!;
    const source = state.groups[0]!;
    const next = appReducer(state, {
      type: 'MOVE_PLAYER',
      playerId: source.playerIds[0]!,
      targetGroupId: fullTarget.id,
    });

    expect(next).toBe(state);
  });

  it('添加重复昵称会被忽略', () => {
    const state = withRoster(2);
    const next = appReducer(state, {
      type: 'ADD_PLAYER',
      name: '球友1',
    });

    expect(next).toBe(state);
  });

  it('删除成员会同步清理分组引用', () => {
    const state = withGroupedRoster(7);
    const removedId = state.groups[0]!.playerIds[2]!;
    const next = appReducer(state, { type: 'REMOVE_PLAYER', id: removedId });

    expect(next.players).toHaveLength(6);
    expect(
      next.groups.flatMap((group) => group.playerIds).includes(removedId),
    ).toBe(false);
    expect(next.unassignedIds).not.toContain(removedId);
  });

  it('重命名场次不允许重复名称', () => {
    const state = withGroupedRoster(12);
    const next = appReducer(state, {
      type: 'RENAME_GROUP',
      id: state.groups[0]!.id,
      label: state.groups[1]!.label,
    });

    expect(next).toBe(state);
  });

  it('进入第二步能看到默认分好的场次', () => {
    const state = withRoster(6);
    const next = appReducer(state, { type: 'SET_STEP', step: 2 });

    expect(next.step).toBe(2);
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]?.playerIds).toHaveLength(6);
  });

  it('未满场次会阻止进入第三步，整理后进入后补', () => {
    const base = withGroupedRoster(13);
    const moved = appReducer(base, {
      type: 'MOVE_PLAYER',
      playerId: base.groups[0]!.playerIds[0]!,
      targetGroupId: null,
    });

    expect(moved.groups.map((group) => group.playerIds.length)).toEqual([5, 6]);
    expect(appReducer(moved, { type: 'SET_STEP', step: 3 })).toBe(moved);

    const normalized = appReducer(moved, { type: 'NORMALIZE_GROUPS' });
    expect(normalized.groups.map((group) => group.playerIds.length)).toEqual([6]);
    expect(normalized.unassignedIds).toHaveLength(7);
    expect(normalized.groups.every((group) => group.playerIds.length === 6)).toBe(true);
  });

  it('FILL_GROUPS 只补后补区，手动排好的满员场次不被改动', () => {
    const base = withGroupedRoster(13);
    const manual = appReducer(base, {
      type: 'ADD_GROUP',
    });
    expect(manual.groups).toHaveLength(3);

    const filled = appReducer(manual, { type: 'FILL_GROUPS' });

    // 原来两场 6 人不动，新场次只有 1 人时不会创建
    expect(filled.groups.slice(0, 2).map((group) => group.playerIds.length)).toEqual([
      6, 6,
    ]);
    expect(filled.groups.every((group) => group.playerIds.length !== 5)).toBe(true);
    expect(filled.unassignedIds).toHaveLength(1);
  });

  it('FILL_GROUPS 把后补的人补进已存在的空场次', () => {
    const base = appReducer(withRoster(13), { type: 'CLEAR_GROUPS' });
    const cleared = appReducer(base, { type: 'NORMALIZE_GROUPS' });
    expect(cleared.unassignedIds).toHaveLength(13);

    const withGroups = appReducer(cleared, { type: 'ADD_GROUP' });
    const filled = appReducer(withGroups, { type: 'FILL_GROUPS' });

    expect(filled.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    expect(filled.unassignedIds).toHaveLength(1);
  });

  it('场次都满员且后补无人可补时 FILL_GROUPS 不产生变更', () => {
    const base = withGroupedRoster(12);
    expect(appReducer(base, { type: 'FILL_GROUPS' })).toBe(base);
  });

  it('FILL_GROUPS 可以撤销', () => {
    const cleared = appReducer(
      appReducer(withRoster(13), { type: 'CLEAR_GROUPS' }),
      { type: 'NORMALIZE_GROUPS' },
    );
    const base = appReducer(cleared, { type: 'ADD_GROUP' });
    const filled = appReducer(base, { type: 'FILL_GROUPS' });

    expect(filled).not.toBe(base);
    expect(filled.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);

    const undone = appReducer(filled, { type: 'UNDO' });
    expect(undone.groups).toEqual(base.groups);
    expect(undone.unassignedIds).toEqual(base.unassignedIds);
  });

  it('SWAP_PLAYER 跨场次互换两人，两边人数不变', () => {
    const state = withRoster(12);
    const [groupA, groupB] = state.groups;
    const from = groupA!.playerIds[0]!;
    const to = groupB!.playerIds[3]!;

    const swapped = appReducer(state, {
      type: 'SWAP_PLAYER',
      sourceId: from,
      targetId: to,
    });

    expect(swapped.groups[0]?.playerIds[0]).toBe(to);
    expect(swapped.groups[1]?.playerIds[3]).toBe(from);
    expect(swapped.groups.map((group) => group.playerIds.length)).toEqual([6, 6]);
    // 不重复、不丢失
    const all = swapped.groups.flatMap((group) => group.playerIds);
    expect(new Set(all).size).toBe(12);
  });

  it('SWAP_PLAYER 与后补区互换', () => {
    const state = withRoster(13);
    const grouped = state.groups[0]!.playerIds[0]!;
    const bench = state.unassignedIds[0]!;

    const swapped = appReducer(state, {
      type: 'SWAP_PLAYER',
      sourceId: grouped,
      targetId: bench,
    });

    expect(swapped.groups[0]?.playerIds[0]).toBe(bench);
    expect(swapped.unassignedIds[0]).toBe(grouped);
    expect(swapped.groups[0]?.playerIds).toHaveLength(6);
  });

  it('SWAP_PLAYER 同组内不交换，SWAP_PLAYER 可撤销', () => {
    const state = withRoster(12);
    const sameGroup = appReducer(state, {
      type: 'SWAP_PLAYER',
      sourceId: state.groups[0]!.playerIds[0]!,
      targetId: state.groups[0]!.playerIds[1]!,
    });
    expect(sameGroup).toBe(state);

    const swapped = appReducer(state, {
      type: 'SWAP_PLAYER',
      sourceId: state.groups[0]!.playerIds[0]!,
      targetId: state.groups[1]!.playerIds[0]!,
    });
    const undone = appReducer(swapped, { type: 'UNDO' });
    expect(undone.groups).toEqual(state.groups);
  });

  it('生成前整理只搬未满场次，满员场次原样保留', () => {
    const base = withGroupedRoster(13);
    const withPartial = appReducer(base, { type: 'ADD_GROUP' });
    const withTwo = appReducer(withPartial, {
      type: 'MOVE_PLAYER',
      playerId: base.unassignedIds[0]!,
      targetGroupId: withPartial.groups[2]!.id,
    });

    const normalized = appReducer(withTwo, { type: 'NORMALIZE_GROUPS' });

    expect(normalized.groups).toHaveLength(2);
    expect(normalized.groups.map((group) => group.playerIds)).toEqual(
      base.groups.map((group) => group.playerIds),
    );
    expect(normalized.unassignedIds).toHaveLength(1);
  });

  it('空场次不会阻止进入第三步', () => {
    const base = withGroupedRoster(12);
    const withEmpty = appReducer(base, { type: 'ADD_GROUP' });

    expect(appReducer(withEmpty, { type: 'SET_STEP', step: 3 }).step).toBe(3);
  });

  it('空名单不能进入第二步', () => {
    const state = createInitialState();
    expect(appReducer(state, { type: 'SET_STEP', step: 2 })).toBe(state);
  });

  it('重置会清空全部数据', () => {
    const state = withRoster(12);
    const reset = appReducer(state, { type: 'RESET' });

    expect(reset.players).toEqual([]);
    expect(reset.groups).toEqual([]);
    expect(reset.rawText).toBe('');
    expect(reset.step).toBe(1);
  });
});
