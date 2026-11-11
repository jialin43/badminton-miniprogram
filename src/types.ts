export const CAPACITY = 6;
export const MAX_PLAYERS = 100;
export const MAX_GROUPS = 24;
export const STORAGE_KEY = 'badminton-grouper:v1';
export const DEFAULT_NOTICE = '两上两下，合理串场，不允许打架，停车免费。';

export type Step = 1 | 2 | 3;

export interface Player {
  id: string;
  name: string;
  isFemale: boolean;
  sourceLine?: number;
}

export interface Group {
  id: string;
  label: string;
  playerIds: string[];
}

export interface EventInfo {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  notice: string;
}

export interface ParsedPlayerDraft {
  name: string;
  isFemale: boolean;
  sourceLine: number;
}

export interface DuplicateEntry {
  name: string;
  lines: number[];
}

export interface IgnoredLine {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  players: ParsedPlayerDraft[];
  duplicates: DuplicateEntry[];
  ignored: IgnoredLine[];
  mode: 'numbered' | 'plain';
  totalLines: number;
}

export interface ImportReport {
  mode: ParseResult['mode'];
  duplicates: DuplicateEntry[];
  ignored: IgnoredLine[];
  parsedAt: number;
}

export interface GroupSnapshot {
  groups: Group[];
  unassignedIds: string[];
}

export interface AppState {
  version: 1;
  step: Step;
  rawText: string;
  players: Player[];
  groups: Group[];
  unassignedIds: string[];
  event: EventInfo;
  capacity: number;
  report: ImportReport | null;
  past: GroupSnapshot[];
  updatedAt: number;
}

export interface PersistedState {
  version: 1;
  step: Step;
  rawText: string;
  players: Player[];
  groups: Group[];
  unassignedIds: string[];
  event: EventInfo;
  capacity: number;
  report: ImportReport | null;
  updatedAt: number;
}
