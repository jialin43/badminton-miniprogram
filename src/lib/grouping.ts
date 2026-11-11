import { CAPACITY } from '../types';
import type { Group, Player } from '../types';
import { uid } from './id';

export interface AutoGroupOptions {
  shuffle?: boolean;
  spreadWomen?: boolean;
  rng?: () => number;
}

export interface GroupingResult {
  groups: Group[];
  unassignedIds: string[];
}

export interface MoveResult extends GroupingResult {
  changed: boolean;
  reason?: 'full' | 'missing' | 'noop';
}

export interface PlayerLocation {
  groupId: string | null;
  index: number;
}

export function groupLabel(index: number): string {
  if (index >= 0 && index < 26) {
    return `${String.fromCharCode(65 + index)}组`;
  }

  return `${index + 1}组`;
}

export function nextGroupLabel(groups: Group[]): string {
  const used = new Set(groups.map((group) => group.label));

  for (let index = 0; index < 26; index += 1) {
    const label = `${String.fromCharCode(65 + index)}组`;
    if (!used.has(label)) return label;
  }

  for (let index = 1; index <= 99; index += 1) {
    const label = `第${index}组`;
    if (!used.has(label)) return label;
  }

  return `第${groups.length + 1}组`;
}

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    const current = result[index];
    result[index] = result[target] as T;
    result[target] = current as T;
  }

  return result;
}

export function groupCountFor(playerCount: number, capacity = CAPACITY): number {
  if (playerCount <= 0) return 0;
  return Math.floor(playerCount / Math.max(1, capacity));
}

/** 去掉容量之外的空场次，避免空卡片占用场次编号。 */
export function pruneEmptyGroups(groups: Group[], minSize = 1): Group[] {
  return groups.filter((group) => group.playerIds.length >= minSize);
}

/** 随机分组结果摘要，用于提示文案。 */
export interface AutoGroupSummary {
  groups: Group[];
  unassignedIds: string[];
  /** 本次补满的场次数 */
  filledGroups: number;
  /** 仍然留在后补区的人数 */
  waitlistCount: number;
  /** 随机时从后补区实际取走的人数 */
  movedCount: number;
}

/**
 * 按后补区补齐满员场次。
 *
 * - 已有分组（含手动拖好的 6 人场次）**原样保留**，不会被冲掉；
 * - 可用空位 = 目标满员场次数 * 6 - 已在场人数，从后补区按随机顺序补入；
 * - 后补区按报名顺序保留，多出来的成员留在后补区；
 * - 单场不足 6 人的“半成品”场次沿用旧规则：不动它，由生成前整理统一移入后补。
 */
export function fillGroups(
  players: Player[],
  groups: Group[],
  unassignedIds: string[],
  capacity = CAPACITY,
  options: AutoGroupOptions = {},
): AutoGroupSummary {
  const safeCapacity = Math.max(1, Math.min(12, Math.floor(capacity) || CAPACITY));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const targetGroupCount = groupCountFor(players.length, safeCapacity);

  if (targetGroupCount === 0) {
    return {
      groups: [],
      unassignedIds: [...unassignedIds],
      filledGroups: 0,
      waitlistCount: unassignedIds.length,
      movedCount: 0,
    };
  }

  const nextGroups = groups.map((group) => ({
    ...group,
    playerIds: [...group.playerIds],
  }));

  const occupied = nextGroups.reduce((total, group) => total + group.playerIds.length, 0);
  const targetSlots = targetGroupCount * safeCapacity;
  const freeSlots = Math.max(0, targetSlots - occupied);

  const poolOrder = options.shuffle
    ? shuffleArray(unassignedIds, options.rng)
    : [...unassignedIds];

  const waitlist: string[] = [];
  const picked: Player[] = [];

  for (const id of poolOrder) {
    if (picked.length >= freeSlots) {
      waitlist.push(id);
      continue;
    }
    const player = playerById.get(id);
    if (!player) continue;
    picked.push(player);
  }

  // 只往有空位的场次里补，凑不够就不新增场次（满 6 人才算一组）。
  const roomyGroups = nextGroups.filter(
    (group) => group.playerIds.length < safeCapacity,
  );

  const order = options.spreadWomen ? distributeWomen(picked, safeCapacity) : picked;
  let cursor = 0;

  for (const group of roomyGroups) {
    while (
      group.playerIds.length < safeCapacity &&
      cursor < order.length
    ) {
      group.playerIds.push(order[cursor]!.id);
      cursor += 1;
    }
  }

  // 新场次只在剩余人数够满一场时才创建。
  while (order.length - cursor >= safeCapacity) {
    const bucket = order
      .slice(cursor, cursor + safeCapacity)
      .map((player) => player.id);
    cursor += safeCapacity;
    nextGroups.push({
      id: uid('g'),
      label: nextGroupLabel(nextGroups),
      playerIds: bucket,
    });
  }

  while (cursor < order.length) {
    waitlist.unshift(order[cursor]!.id);
    cursor += 1;
  }

  // 后补区保持报名顺序：按原 unassignedIds 顺序输出仍在后补的人。
  const waitlistSet = new Set(waitlist);
  const orderedWaitlist = unassignedIds.filter((id) => waitlistSet.has(id));
  for (const id of waitlist) {
    if (!orderedWaitlist.includes(id)) orderedWaitlist.push(id);
  }

  const filledGroups = nextGroups.filter(
    (group) => group.playerIds.length >= safeCapacity,
  ).length;

  return {
    groups: nextGroups,
    unassignedIds: orderedWaitlist,
    filledGroups,
    waitlistCount: orderedWaitlist.length,
    movedCount: picked.length,
  };
}

/** 把女生尽量打散到不同场次：按“女生少的组优先”交出顺序。 */
function distributeWomen(players: Player[], capacity: number): Player[] {
  const women = players.filter((player) => player.isFemale);
  const others = players.filter((player) => !player.isFemale);
  if (women.length <= 1) return [...women, ...others];

  const buckets: Player[][] = Array.from(
    { length: Math.max(1, Math.ceil(players.length / capacity)) },
    () => [],
  );

  for (const player of women) {
    let target = 0;
    for (let index = 1; index < buckets.length; index += 1) {
      if (bucketWeight(buckets[index]!) < bucketWeight(buckets[target]!)) {
        target = index;
      }
    }
    buckets[target]!.push(player);
  }

  for (const player of others) {
    let target = 0;
    for (let index = 1; index < buckets.length; index += 1) {
      if (buckets[index]!.length < buckets[target]!.length) target = index;
    }
    buckets[target]!.push(player);
  }

  return buckets.flat();
}

function bucketWeight(bucket: Player[]): number {
  return bucket.length * 100 + bucket.filter((player) => player.isFemale).length;
}

/**
 * 全重排：清掉现有场次，把所有人按顺序（或随机）重新均分。
 * 只有用户二次确认后才会调用。
 */
export function autoGroup(
  players: Player[],
  capacity = CAPACITY,
  existingGroups: Group[] = [],
  options: AutoGroupOptions = {},
): GroupingResult {
  const safeCapacity = Math.max(1, Math.min(12, Math.floor(capacity) || CAPACITY));
  const ordered = options.shuffle
    ? shuffleArray(players, options.rng)
    : [...players];
  const groupCount = groupCountFor(ordered.length, safeCapacity);

  if (groupCount === 0) {
    return {
      groups: [],
      unassignedIds: ordered.map((player) => player.id),
    };
  }

  const sequence = options.spreadWomen
    ? distributeWomen(ordered, safeCapacity)
    : ordered;
  const buckets: Player[][] = Array.from({ length: groupCount }, () => []);

  sequence.forEach((player, index) => {
    if (index < groupCount * safeCapacity) {
      buckets[Math.floor(index / safeCapacity)]!.push(player);
    }
  });

  const assigned = new Set(
    buckets.flatMap((bucket) => bucket.map((player) => player.id)),
  );
  const waitlistIds = ordered
    .filter((player) => !assigned.has(player.id))
    .map((player) => player.id);

  const groups: Group[] = buckets.map((bucket, index) => {
    const existing = existingGroups[index];
    return {
      id: existing?.id ?? uid('g'),
      label: existing?.label ?? groupLabel(index),
      playerIds: bucket.map((player) => player.id),
    };
  });

  return { groups, unassignedIds: waitlistIds };
}

function findLocation(
  groups: Group[],
  unassignedIds: string[],
  playerId: string,
): (PlayerLocation & { source: 'pool' | 'group' }) | null {
  const poolIndex = unassignedIds.indexOf(playerId);
  if (poolIndex >= 0) {
    return { groupId: null, index: poolIndex, source: 'pool' };
  }

  for (const group of groups) {
    const index = group.playerIds.indexOf(playerId);
    if (index >= 0) {
      return { groupId: group.id, index, source: 'group' };
    }
  }

  return null;
}

/**
 * 将成员移动到目标小组或后补名单。
 * targetIndex 表示“插入到目标容器原顺序中的第几个位置”，不传则追加到末尾。
 */
export function movePlayer(
  groups: Group[],
  unassignedIds: string[],
  playerId: string,
  targetGroupId: string | null,
  targetIndex?: number,
  capacity = CAPACITY,
): MoveResult {
  const source = findLocation(groups, unassignedIds, playerId);
  if (!source) {
    return {
      groups,
      unassignedIds,
      changed: false,
      reason: 'missing',
    };
  }

  const targetGroupIndex =
    targetGroupId === null
      ? -1
      : groups.findIndex((group) => group.id === targetGroupId);

  if (targetGroupId !== null && targetGroupIndex < 0) {
    return {
      groups,
      unassignedIds,
      changed: false,
      reason: 'missing',
    };
  }

  const targetOriginalLength =
    targetGroupId === null
      ? unassignedIds.length
      : (groups[targetGroupIndex]?.playerIds.length ?? 0);

  if (
    targetGroupId !== null &&
    targetOriginalLength >= capacity &&
    source.groupId !== targetGroupId
  ) {
    return {
      groups,
      unassignedIds,
      changed: false,
      reason: 'full',
    };
  }

  let insertAt = targetIndex ?? targetOriginalLength;

  if (source.source === 'pool' && targetGroupId === null) {
    if (insertAt > source.index) insertAt -= 1;
    if (insertAt === source.index) {
      return {
        groups,
        unassignedIds,
        changed: false,
        reason: 'noop',
      };
    }
  }

  if (source.groupId !== null && source.groupId === targetGroupId) {
    if (insertAt > source.index) insertAt -= 1;
    if (insertAt === source.index) {
      return {
        groups,
        unassignedIds,
        changed: false,
        reason: 'noop',
      };
    }
  }

  const nextGroups = groups.map((group) => ({
    ...group,
    playerIds: [...group.playerIds],
  }));
  const nextUnassigned = [...unassignedIds];

  if (source.source === 'pool') {
    nextUnassigned.splice(source.index, 1);
  } else {
    const sourceGroupIndex = nextGroups.findIndex(
      (group) => group.id === source.groupId,
    );
    if (sourceGroupIndex >= 0) {
      nextGroups[sourceGroupIndex]!.playerIds.splice(source.index, 1);
    }
  }

  if (targetGroupId === null) {
    const clamped = Math.max(0, Math.min(insertAt, nextUnassigned.length));
    nextUnassigned.splice(clamped, 0, playerId);
  } else {
    const target = nextGroups[targetGroupIndex]!;
    if (target.playerIds.length >= capacity) {
      return {
        groups,
        unassignedIds,
        changed: false,
        reason: 'full',
      };
    }
    const clamped = Math.max(0, Math.min(insertAt, target.playerIds.length));
    target.playerIds.splice(clamped, 0, playerId);
  }

  return {
    groups: nextGroups,
    unassignedIds: nextUnassigned,
    changed: true,
  };
}

/**
 * 跨场次互换两位成员的位置。
 * 用于把 A 组的甲拖到 B 组的乙身上：两边人数不变，只交换两人所在场次与位置。
 * 同一个人或同一场次内不做交换，返回 changed: false。
 */
export function swapPlayers(
  groups: Group[],
  unassignedIds: string[],
  sourceId: string,
  targetId: string,
  capacity = CAPACITY,
): MoveResult {
  if (sourceId === targetId) {
    return { groups, unassignedIds, changed: false, reason: 'noop' };
  }

  const safeCapacity = Math.max(1, Math.floor(capacity) || CAPACITY);

  // 先确认两人都在布局里，再判断是否跨场次。
  const from = findLocation(groups, unassignedIds, sourceId);
  const to = findLocation(groups, unassignedIds, targetId);
  if (!from || !to) {
    return { groups, unassignedIds, changed: false, reason: 'missing' };
  }

  // 同场次内（包括都在后补区）交给 movePlayer 做排序。
  if (from.groupId === to.groupId) {
    return {
      groups,
      unassignedIds,
      changed: false,
      reason: 'noop',
    };
  }

  const nextGroups = groups.map((group) => ({
    ...group,
    playerIds: [...group.playerIds],
  }));
  const nextUnassigned = [...unassignedIds];

  const place = (groupId: string | null, index: number, value: string) => {
    if (groupId === null) {
      nextUnassigned[index] = value;
      return;
    }
    const group = nextGroups.find((entry) => entry.id === groupId);
    if (group) group.playerIds[index] = value;
  };

  place(from.groupId, from.index, targetId);
  place(to.groupId, to.index, sourceId);

  // 互换后两边人数不变，但场次可能超过容量（理论上不会），兜底拦下。
  const overflow = nextGroups.some(
    (group) => group.playerIds.length > safeCapacity,
  );
  if (overflow) {
    return { groups, unassignedIds, changed: false, reason: 'full' };
  }

  return {
    groups: nextGroups,
    unassignedIds: nextUnassigned,
    changed: true,
  };
}

export function removePlayerFromLayout(
  groups: Group[],
  unassignedIds: string[],
  playerId: string,
): GroupingResult {
  return {
    groups: groups.map((group) => ({
      ...group,
      playerIds: group.playerIds.filter((id) => id !== playerId),
    })),
    unassignedIds: unassignedIds.filter((id) => id !== playerId),
  };
}

export function locatePlayer(
  groups: Group[],
  unassignedIds: string[],
  playerId: string,
): PlayerLocation | null {
  const location = findLocation(groups, unassignedIds, playerId);
  if (!location) return null;

  return { groupId: location.groupId, index: location.index };
}

export function assignedPlayerIds(groups: Group[]): Set<string> {
  const assigned = new Set<string>();
  for (const group of groups) {
    for (const id of group.playerIds) assigned.add(id);
  }
  return assigned;
}
