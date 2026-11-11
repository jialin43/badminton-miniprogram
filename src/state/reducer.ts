import { CAPACITY, DEFAULT_NOTICE, MAX_GROUPS, MAX_PLAYERS } from '../types';
import type {
  AppState,
  EventInfo,
  GroupSnapshot,
  ImportReport,
  ParsedPlayerDraft,
  Player,
  Step,
} from '../types';
import {
  autoGroup,
  fillGroups,
  movePlayer,
  nextGroupLabel,
  pruneEmptyGroups,
  removePlayerFromLayout,
  swapPlayers,
} from '../lib/grouping';
import { todayISO } from '../lib/date';
import { nameKey, type EventHints } from '../lib/parser';
import { uid } from '../lib/id';

const DEFAULT_TITLE = '本周羽毛球分组';
const DEFAULT_START = '19:00';
const DEFAULT_END = '21:00';

export type AppAction =
  | { type: 'SET_STEP'; step: Step }
  | { type: 'SET_RAW_TEXT'; text: string }
  | {
      type: 'SET_ROSTER';
      drafts: ParsedPlayerDraft[];
      report: ImportReport;
      hints?: EventHints;
    }
  | { type: 'UPDATE_PLAYER'; id: string; name: string }
  | { type: 'TOGGLE_FEMALE'; id: string }
  | { type: 'ADD_PLAYER'; name: string; isFemale?: boolean }
  | { type: 'REMOVE_PLAYER'; id: string }
  | {
      type: 'MOVE_PLAYER';
      playerId: string;
      targetGroupId: string | null;
      index?: number;
    }
  | {
      type: 'SWAP_PLAYER';
      sourceId: string;
      targetId: string;
    }
  | { type: 'AUTO_GROUP'; shuffle: boolean }
  | { type: 'FILL_GROUPS' }
  | { type: 'NORMALIZE_GROUPS' }
  | { type: 'CLEAR_GROUPS' }
  | { type: 'UNDO' }
  | { type: 'SET_EVENT'; event: EventInfo }
  | { type: 'ADD_GROUP' }
  | { type: 'RENAME_GROUP'; id: string; label: string }
  | { type: 'REMOVE_GROUP'; id: string }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: AppState };

export function createInitialState(now = Date.now()): AppState {
  return {
    version: 1,
    step: 1,
    rawText: '',
    players: [],
    groups: [],
    unassignedIds: [],
    event: {
      title: DEFAULT_TITLE,
      date: todayISO(),
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      venue: '',
      notice: DEFAULT_NOTICE,
    },
    capacity: CAPACITY,
    report: null,
    past: [],
    updatedAt: now,
  };
}

function snapshotGroups(state: AppState): GroupSnapshot {
  return {
    groups: state.groups.map((group) => ({
      ...group,
      playerIds: [...group.playerIds],
    })),
    unassignedIds: [...state.unassignedIds],
  };
}

function withHistory(
  state: AppState,
  next: Pick<AppState, 'groups' | 'unassignedIds'>,
): AppState {
  const snapshot = snapshotGroups(state);
  return {
    ...state,
    groups: next.groups,
    unassignedIds: next.unassignedIds,
    past: [...state.past, snapshot].slice(-30),
    updatedAt: Date.now(),
  };
}

function applyHints(event: EventInfo, hints?: EventHints): EventInfo {
  if (!hints) return event;

  const next = { ...event };
  if (hints.venue && !next.venue.trim()) {
    next.venue = hints.venue;
  }
  if (hints.date && next.date === todayISO()) {
    next.date = hints.date;
  }
  if (
    hints.startTime &&
    hints.endTime &&
    next.startTime === DEFAULT_START &&
    next.endTime === DEFAULT_END
  ) {
    next.startTime = hints.startTime;
    next.endTime = hints.endTime;
  }

  return next;
}

function makePlayer(draft: ParsedPlayerDraft): Player {
  return {
    id: uid('p'),
    name: draft.name.trim().slice(0, 30),
    isFemale: draft.isFemale,
    ...(draft.sourceLine > 0 ? { sourceLine: draft.sourceLine } : {}),
  };
}

function restoreSnapshot(state: AppState, snapshot: GroupSnapshot): AppState {
  const validPlayers = new Set(state.players.map((player) => player.id));
  const assigned = new Set<string>();
  const seenPool = new Set<string>();

  const groups = snapshot.groups.map((group) => ({
    ...group,
    playerIds: group.playerIds.filter((id) => {
      if (!validPlayers.has(id) || assigned.has(id)) return false;
      assigned.add(id);
      return true;
    }),
  }));

  const unassignedIds: string[] = [];
  for (const id of snapshot.unassignedIds) {
    if (!validPlayers.has(id) || assigned.has(id) || seenPool.has(id)) continue;
    seenPool.add(id);
    unassignedIds.push(id);
  }

  for (const player of state.players) {
    if (!assigned.has(player.id) && !seenPool.has(player.id)) {
      seenPool.add(player.id);
      unassignedIds.push(player.id);
    }
  }

  return {
    ...state,
    groups,
    unassignedIds,
    past: state.past.slice(0, -1),
    updatedAt: Date.now(),
  };
}

function stepIsReachable(state: AppState, step: Step): boolean {
  if (step === 1) return true;
  if (state.players.length === 0) return false;
  if (step === 3) {
    // 只有满员场次才算一组，空场次不参与判断。
    const playable = pruneEmptyGroups(state.groups);
    if (playable.length === 0) return false;
    if (
      playable.some((group) => group.playerIds.length < state.capacity)
    ) {
      return false;
    }
  }
  return true;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP': {
      if (!stepIsReachable(state, action.step)) return state;
      return { ...state, step: action.step, updatedAt: Date.now() };
    }

    case 'SET_RAW_TEXT':
      return {
        ...state,
        rawText: action.text.slice(0, 20_000),
        updatedAt: Date.now(),
      };

    case 'SET_ROSTER': {
      const players = action.drafts
        .slice(0, MAX_PLAYERS)
        .map(makePlayer)
        .filter((player) => player.name.length > 0);

      // 默认按接龙顺序分组：满 6 人成一场，余下的进后补。
      const initial = autoGroup(players, state.capacity);

      return {
        ...state,
        step: 1,
        players,
        groups: initial.groups,
        unassignedIds: initial.unassignedIds,
        report: action.report,
        event: applyHints(state.event, action.hints),
        past: [],
        updatedAt: Date.now(),
      };
    }

    case 'UPDATE_PLAYER': {
      const rawName = action.name.trim();
      const hasRose = rawName.includes('🌹');
      const name = rawName.replace(/🌹/gu, '').trim().slice(0, 30);
      if (!name) return state;

      return {
        ...state,
        players: state.players.map((player) =>
          player.id === action.id
            ? { ...player, name, isFemale: hasRose ? true : player.isFemale }
            : player,
        ),
        updatedAt: Date.now(),
      };
    }

    case 'TOGGLE_FEMALE':
      return {
        ...state,
        players: state.players.map((player) =>
          player.id === action.id
            ? { ...player, isFemale: !player.isFemale }
            : player,
        ),
        updatedAt: Date.now(),
      };

    case 'ADD_PLAYER': {
      const rawName = action.name.trim();
      const hasRose = rawName.includes('🌹');
      const name = rawName.replace(/🌹/gu, '').trim().slice(0, 30);
      if (!name) return state;

      const key = nameKey(name);
      const isFemale = Boolean(action.isFemale) || hasRose;
      if (
        state.players.some(
          (player) =>
            nameKey(player.name) === key && player.isFemale === isFemale,
        )
      ) {
        return state;
      }

      const player: Player = {
        id: uid('p'),
        name,
        isFemale,
      };
      return {
        ...state,
        players: [...state.players, player],
        unassignedIds: [...state.unassignedIds, player.id],
        updatedAt: Date.now(),
      };
    }

    case 'REMOVE_PLAYER': {
      const players = state.players.filter((player) => player.id !== action.id);
      if (players.length === state.players.length) return state;

      const cleaned = removePlayerFromLayout(
        state.groups,
        state.unassignedIds,
        action.id,
      );

      return {
        ...state,
        players,
        groups: players.length === 0 ? [] : cleaned.groups,
        unassignedIds: players.length === 0 ? [] : cleaned.unassignedIds,
        updatedAt: Date.now(),
      };
    }

    case 'MOVE_PLAYER': {
      const result = movePlayer(
        state.groups,
        state.unassignedIds,
        action.playerId,
        action.targetGroupId,
        action.index,
        state.capacity,
      );

      if (!result.changed) return state;

      return withHistory(state, {
        groups: result.groups,
        unassignedIds: result.unassignedIds,
      });
    }

    case 'AUTO_GROUP': {
      const grouped = autoGroup(state.players, state.capacity, state.groups, {
        shuffle: action.shuffle,
        spreadWomen: action.shuffle,
      });

      return withHistory(state, grouped);
    }

    case 'SWAP_PLAYER': {
      const result = swapPlayers(
        state.groups,
        state.unassignedIds,
        action.sourceId,
        action.targetId,
        state.capacity,
      );

      if (!result.changed) return state;

      return withHistory(state, {
        groups: result.groups,
        unassignedIds: result.unassignedIds,
      });
    }

    case 'FILL_GROUPS': {
      const summary = fillGroups(
        state.players,
        state.groups,
        state.unassignedIds,
        state.capacity,
        { shuffle: true, spreadWomen: true },
      );

      if (summary.movedCount === 0) return state;

      return withHistory(state, {
        groups: summary.groups,
        unassignedIds: summary.unassignedIds,
      });
    }

    case 'NORMALIZE_GROUPS': {
      const full = state.groups.filter(
        (group) => group.playerIds.length >= state.capacity,
      );
      const partial = state.groups.filter(
        (group) =>
          group.playerIds.length > 0 &&
          group.playerIds.length < state.capacity,
      );
      const hasEmpty = state.groups.length > full.length + partial.length;
      if (partial.length === 0 && !hasEmpty) return state;

      // 未满场次的人回到后补区；满员场次一动不动，人不会重复计算。
      const fullIds = new Set(full.flatMap((group) => group.playerIds));
      const returned = partial.flatMap((group) => group.playerIds);
      const waitlist: string[] = [];
      const seen = new Set<string>();
      const push = (id: string) => {
        if (fullIds.has(id) || seen.has(id)) return;
        seen.add(id);
        waitlist.push(id);
      };

      // 先保持后补区原有顺序，再按报名顺序补进残缺场次退回的人。
      for (const id of state.unassignedIds) push(id);
      for (const player of state.players) push(player.id);
      for (const id of returned) push(id);

      return withHistory(state, {
        groups: full,
        unassignedIds: waitlist,
      });
    }

    case 'CLEAR_GROUPS': {
      if (state.groups.length === 0 || state.players.length === 0) return state;

      return withHistory(state, {
        groups: state.groups.map((group) => ({ ...group, playerIds: [] })),
        unassignedIds: state.players.map((player) => player.id),
      });
    }

    case 'UNDO': {
      const snapshot = state.past.at(-1);
      if (!snapshot) return state;
      return restoreSnapshot(state, snapshot);
    }

    case 'SET_EVENT':
      return {
        ...state,
        event: {
          title: action.event.title.trim().slice(0, 32) || DEFAULT_TITLE,
          date: action.event.date,
          startTime: action.event.startTime,
          endTime: action.event.endTime,
          venue: action.event.venue.trim().slice(0, 40),
          notice:
            action.event.notice.trim().replace(/\s+/g, ' ').slice(0, 120) ||
            DEFAULT_NOTICE,
        },
        updatedAt: Date.now(),
      };

    case 'ADD_GROUP': {
      if (state.groups.length >= MAX_GROUPS) return state;

      return {
        ...state,
        groups: [
          ...state.groups,
          {
            id: uid('g'),
            label: nextGroupLabel(state.groups),
            playerIds: [],
          },
        ],
        updatedAt: Date.now(),
      };
    }

    case 'RENAME_GROUP': {
      const label = action.label.trim().slice(0, 12);
      if (!label) return state;
      if (
        state.groups.some(
          (group) => group.id !== action.id && group.label === label,
        )
      ) {
        return state;
      }

      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === action.id ? { ...group, label } : group,
        ),
        updatedAt: Date.now(),
      };
    }

    case 'REMOVE_GROUP': {
      const group = state.groups.find((entry) => entry.id === action.id);
      if (!group || group.playerIds.length > 0) return state;

      return {
        ...state,
        groups: state.groups.filter((entry) => entry.id !== action.id),
        updatedAt: Date.now(),
      };
    }

    case 'RESET':
      return createInitialState();

    case 'HYDRATE':
      return { ...action.state, past: [] };

    default:
      return state;
  }
}
