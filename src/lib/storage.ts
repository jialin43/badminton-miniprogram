import Taro from '@tarojs/taro';
import {
  CAPACITY,
  DEFAULT_NOTICE,
  MAX_GROUPS,
  MAX_PLAYERS,
  STORAGE_KEY,
} from '../types';
import type {
  AppState,
  DuplicateEntry,
  EventInfo,
  Group,
  IgnoredLine,
  ImportReport,
  PersistedState,
  Player,
  Step,
} from '../types';
import {
  isValidTimeRange,
  parseDateParts,
  todayISO,
} from './date';
import { groupLabel } from './grouping';

const DEFAULT_TITLE = '本周羽毛球分组';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeReport(value: unknown): ImportReport | null {
  if (!isRecord(value)) return null;

  const mode = value.mode === 'numbered' || value.mode === 'plain' ? value.mode : null;
  if (!mode) return null;

  const duplicates: DuplicateEntry[] = Array.isArray(value.duplicates)
    ? value.duplicates
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          name: asString(entry.name).slice(0, 30),
          lines: Array.isArray(entry.lines)
            ? entry.lines.filter((line): line is number => typeof line === 'number')
            : [],
        }))
        .filter((entry) => entry.name.length > 0)
    : [];

  const ignored: IgnoredLine[] = Array.isArray(value.ignored)
    ? value.ignored
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          line: typeof entry.line === 'number' ? entry.line : 0,
          text: asString(entry.text).slice(0, 80),
          reason: asString(entry.reason).slice(0, 60),
        }))
    : [];

  return {
    mode,
    duplicates,
    ignored,
    parsedAt: typeof value.parsedAt === 'number' ? value.parsedAt : Date.now(),
  };
}

function sanitizeEvent(value: unknown): EventInfo {
  const raw = isRecord(value) ? value : {};
  const title = asString(raw.title).trim().slice(0, 32) || DEFAULT_TITLE;
  const date =
    typeof raw.date === 'string' && parseDateParts(raw.date)
      ? raw.date
      : todayISO();
  const startTime = asString(raw.startTime, '19:00');
  const endTime = asString(raw.endTime, '21:00');
  const safeTimes = isValidTimeRange(startTime, endTime)
    ? { startTime, endTime }
    : { startTime: '19:00', endTime: '21:00' };

  return {
    title,
    date,
    startTime: safeTimes.startTime,
    endTime: safeTimes.endTime,
    venue: asString(raw.venue).trim().slice(0, 40),
    notice:
      asString(raw.notice).trim().replace(/\s+/g, ' ').slice(0, 120) ||
      DEFAULT_NOTICE,
  };
}

function sanitizePlayers(value: unknown): Player[] {
  if (!Array.isArray(value)) return [];

  const players: Player[] = [];
  const ids = new Set<string>();

  for (const entry of value.slice(0, MAX_PLAYERS)) {
    if (!isRecord(entry)) continue;

    const id = asString(entry.id).trim();
    const name = asString(entry.name)
      .replace(/🌹/gu, '')
      .trim()
      .slice(0, 30);

    if (!id || !name || ids.has(id)) continue;

    ids.add(id);
    players.push({
      id,
      name,
      isFemale: Boolean(entry.isFemale),
      ...(typeof entry.sourceLine === 'number'
        ? { sourceLine: entry.sourceLine }
        : {}),
    });
  }

  return players;
}

function sanitizeGroups(
  value: unknown,
  players: Player[],
  capacity: number,
): { groups: Group[]; assigned: Set<string> } {
  const groups: Group[] = [];
  const groupIds = new Set<string>();
  const assigned = new Set<string>();
  const validPlayerIds = new Set(players.map((player) => player.id));

  if (!Array.isArray(value)) return { groups, assigned };

  for (const entry of value.slice(0, MAX_GROUPS)) {
    if (!isRecord(entry)) continue;

    const id = asString(entry.id).trim();
    if (!id || groupIds.has(id)) continue;
    groupIds.add(id);

    const group: Group = {
      id,
      label:
        asString(entry.label).trim().slice(0, 12) || groupLabel(groups.length),
      playerIds: [],
    };

    const rawIds = Array.isArray(entry.playerIds) ? entry.playerIds : [];
    for (const rawId of rawIds) {
      if (typeof rawId !== 'string') continue;
      if (!validPlayerIds.has(rawId)) continue;
      if (assigned.has(rawId)) continue;
      if (group.playerIds.length >= capacity) continue;

      group.playerIds.push(rawId);
      assigned.add(rawId);
    }

    groups.push(group);
  }

  return { groups, assigned };
}

function sanitizeStep(value: unknown, hasPlayers: boolean, hasGroups: boolean): Step {
  if (value === 3 && hasPlayers && hasGroups) return 3;
  if (value === 2 && hasPlayers) return 2;
  return 1;
}

export function hydrateState(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null;

  const capacity = CAPACITY;
  const players = sanitizePlayers(raw.players);
  const { groups, assigned } = sanitizeGroups(raw.groups, players, capacity);

  const unassignedIds: string[] = [];
  const poolIds = new Set<string>();

  if (Array.isArray(raw.unassignedIds)) {
    for (const id of raw.unassignedIds) {
      if (typeof id !== 'string') continue;
      if (!players.some((player) => player.id === id)) continue;
      if (assigned.has(id) || poolIds.has(id)) continue;
      poolIds.add(id);
      unassignedIds.push(id);
    }
  }

  for (const player of players) {
    if (!assigned.has(player.id) && !poolIds.has(player.id)) {
      poolIds.add(player.id);
      unassignedIds.push(player.id);
    }
  }

  const event = sanitizeEvent(raw.event);
  const report = sanitizeReport(raw.report);
  const step = sanitizeStep(
    raw.step,
    players.length > 0,
    groups.length > 0,
  );

  return {
    version: 1,
    step,
    rawText: asString(raw.rawText).slice(0, 20_000),
    players,
    groups,
    unassignedIds,
    event,
    capacity,
    report,
    past: [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

export function toPersisted(state: AppState): PersistedState {
  return {
    version: 1,
    step: state.step,
    rawText: state.rawText,
    players: state.players,
    groups: state.groups,
    unassignedIds: state.unassignedIds,
    event: state.event,
    capacity: state.capacity,
    report: state.report,
    updatedAt: state.updatedAt,
  };
}

export function saveState(state: AppState): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(toPersisted(state)));
  } catch {
    // 存储空间不足时静默失败，页面仍可正常使用。
  }
}

export function loadState(): AppState | null {
  try {
    const text = Taro.getStorageSync(STORAGE_KEY);
    if (typeof text !== 'string' || !text) return null;

    const parsed: unknown = JSON.parse(text);
    return hydrateState(parsed);
  } catch {
    return null;
  }
}

export function clearSavedState(): void {
  try {
    Taro.removeStorageSync(STORAGE_KEY);
  } catch {
    // 忽略
  }
}

const VENUE_KEY = 'badminton-grouper:venues';

export function loadRecentVenues(): string[] {
  try {
    const stored = Taro.getStorageSync(VENUE_KEY);
    const raw: unknown = JSON.parse(
      typeof stored === 'string' && stored ? stored : '[]',
    );
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function rememberVenue(venue: string): string[] {
  const name = venue.trim().slice(0, 40);
  if (!name) return loadRecentVenues();

  const next = [name, ...loadRecentVenues().filter((item) => item !== name)].slice(0, 5);

  try {
    Taro.setStorageSync(VENUE_KEY, JSON.stringify(next));
  } catch {
    // 忽略
  }

  return next;
}
