import { MAX_PLAYERS } from '../types';
import type {
  DuplicateEntry,
  IgnoredLine,
  ParseResult,
  ParsedPlayerDraft,
} from '../types';

const FEMALE_MARK = '🌹';
const ZERO_WIDTH = /[\u200b-\u200d\ufeff]/g;
const NUMBERED_PATTERNS = [
  /^\s*(\d{1,3})\s*[.、．)）:：]\s*(.*)$/u,
  /^\s*(\d{1,3})\s+(.*)$/u,
];

const META_WORDS = [
  '时间',
  '日期',
  '地点',
  '场馆',
  '场地',
  '费用',
  '人均',
  '收费',
  '人数',
  '备注',
  '注意',
  '须知',
  '已报名',
  '当前',
  '活动',
  '主题',
  '组织',
  '负责人',
  '联系人',
  '电话',
  '电话报名',
  '限额',
  '截止',
  '报名截止',
  '取消费',
  '用球',
  '球场',
] as const;

/**
 * 只在该词后面紧跟分隔符、或整行仅由该词构成时，才算“元信息前缀”。
 * 裸词匹配会把“时间管理”“地点阿哲”这类昵称误判成头部。
 */
const META_PREFIX = new RegExp(
  `^(?:${META_WORDS.join('|')})\\s*(?:[:：]|$|\\s{2,})`,
  'u',
);

/** 昵称里“有意义”的字符：文字、数字、表情符号及其修饰符。 */
const MEANINGFUL_CHAR =
  /[\p{L}\p{N}\p{Extended_Pictographic}\p{Emoji_Component}\p{Emoji_Modifier}]/u;

/** 没有任何文字/数字、只由表情符号构成，视为“纯表情昵称”。 */
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}\s\ufe0f\u200d]+$/u;

/** 只写了“+1 / 1 / 加一”这类接龙暗号，没有昵称。 */
const PLUS_ONE = /^(?:加)?(?:\+|\+|＋)?\s*(?:1|一|一个)$/u;

interface SourceLine {
  text: string;
  line: number;
}

interface Candidate extends SourceLine {
  numbered: boolean;
  content?: string;
}

interface ExtractResult {
  name: string;
  isFemale: boolean;
}

function stripWrapping(value: string): string {
  return value
    .replace(/^[\s"'“”‘’\-–—·•,，、:：]+/u, '')
    .replace(/[\s"'“”‘’\-–—·•,，、:：]+$/u, '');
}

/** 只由表情符号构成，没有文字和数字。 */
export function isEmojiOnlyName(name: string): boolean {
  const text = name.trim();
  if (!text) return false;
  if (/[\p{L}\p{N}]/u.test(text)) return false;

  return EMOJI_ONLY.test(text);
}

/** 编号后只写了“+1 / 1 / 加一”这类接龙暗号，没有昵称。 */
export function isPlusOnePlaceholder(name: string): boolean {
  return PLUS_ONE.test(name.trim());
}

/** “+1 / 加一”这类暗号的统称，便于在海报和名单里显示。 */
export const PLUS_ONE_NAME = '表情接龙';

export function extractName(raw: string): ExtractResult {
  const isFemale = raw.includes(FEMALE_MARK);
  const cleaned = raw
    .trim()
    .replace(/^@+/u, '')
    .replace(/\s+/gu, ' ');
  const withoutRose = stripWrapping(cleaned.replace(/🌹/gu, ''));

  // 剥掉 🌹 后为空时不能直接丢弃：纯表情接龙（🎾 / 👌🏻 / 🌹🏸）很常见，
  // 保留原文才不会把整条报名静默吞掉。
  const name = withoutRose || (isEmojiOnlyName(cleaned) ? cleaned : '');

  return { name, isFemale };
}

export function nameKey(name: string): string {
  const key = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, '')
    .replace(/[·•.,，。!！?？'"“”‘’()（）【】\[\]_\-–—]/gu, '');

  return key || name.trim().toLowerCase();
}

/**
 * 昵称去重指纹。纯表情昵称一律返回 null：
 * 群里多人各发一个 👍 是常态，都应当算作独立的报名者。
 */
export function dedupeKey(name: string): string | null {
  if (isEmojiOnlyName(name)) return null;

  return nameKey(name);
}

/**
 * 判断一行是否更像接龙头部 / 元信息，而不是昵称。
 * 仅用于无编号行，带编号的行不会走这里。
 */
export function isMetaLine(input: string): boolean {
  const text = input.trim();
  if (!text) return true;

  if (/^[#＃]/u.test(text)) return true;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/u.test(text)) return true;
  if (/^\d{4}年\d{1,2}月\d{1,2}日/u.test(text)) return true;
  if (/^\d{1,2}[./-]\d{1,2}(?:\s|日|$)/u.test(text)) return true;
  if (/^\d{1,2}月\d{1,2}日/u.test(text)) return true;
  if (
    /^\d{1,2}[:：]\d{2}(?:\s*[-–—~至]\s*\d{1,2}[:：]\d{2})?/u.test(text)
  ) {
    return true;
  }
  if (
    /^(?:周|星期)[一二三四五六日天]/u.test(text) &&
    /(?:羽毛球|活动|报名|接龙|场地|时间|地点)/u.test(text)
  ) {
    return true;
  }
  if (META_PREFIX.test(text)) return true;
  if (/^共\s*\d+\s*人/u.test(text)) return true;
  if (/(?:接龙|报名)\s*$/u.test(text) && text.length <= 30) return true;

  return false;
}

function matchNumbered(text: string): { content: string } | null {
  if (isMetaLine(text)) return null;

  for (const pattern of NUMBERED_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      return { content: match[2] ?? '' };
    }
  }

  return null;
}

function truncateForReport(text: string): string {
  return Array.from(text).slice(0, 80).join('');
}

function validateName(name: string): string | null {
  if (!name) return '编号后没有昵称';
  if (!MEANINGFUL_CHAR.test(name)) {
    return '未包含文字、数字或表情';
  }
  if (Array.from(name).length > 30) return '昵称过长';
  return null;
}

/**
 * 解析微信接龙文本。
 *
 * 有编号行时使用严格模式：只识别编号行，其余非元信息行进入“未识别”；
 * 没有编号行时使用宽松模式：所有非元信息行都当作昵称。
 */
export function parseSignup(input: string): ParseResult {
  const normalized = input.replace(/\r\n?/g, '\n').replace(ZERO_WIDTH, '');
  const lines: SourceLine[] = normalized
    .split('\n')
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter((entry) => entry.text.length > 0);

  const numberedCandidates: Candidate[] = [];
  const numberedSet = new Set<number>();

  for (const entry of lines) {
    const match = matchNumbered(entry.text);
    if (match) {
      numberedCandidates.push({ ...entry, numbered: true, content: match.content });
      numberedSet.add(entry.line);
    }
  }

  const mode: ParseResult['mode'] =
    numberedCandidates.length > 0 ? 'numbered' : 'plain';
  const candidates: Candidate[] = [...numberedCandidates];
  const ignored: IgnoredLine[] = [];

  if (mode === 'numbered') {
    for (const entry of lines) {
      if (numberedSet.has(entry.line)) continue;
      if (isMetaLine(entry.text)) continue;
      ignored.push({
        line: entry.line,
        text: truncateForReport(entry.text),
        reason: '未使用编号',
      });
    }
  } else {
    for (const entry of lines) {
      if (isMetaLine(entry.text)) continue;
      candidates.push({ ...entry, numbered: false });
    }
  }

  const players: ParsedPlayerDraft[] = [];
  const seen = new Map<string, { name: string; lines: number[] }>();

  for (const candidate of candidates) {
    if (players.length >= MAX_PLAYERS) {
      ignored.push({
        line: candidate.line,
        text: truncateForReport(candidate.text),
        reason: `超过 ${MAX_PLAYERS} 人上限`,
      });
      continue;
    }

    const extracted = extractName(candidate.content ?? candidate.text);
    const error = validateName(extracted.name);

    if (error) {
      ignored.push({
        line: candidate.line,
        text: truncateForReport(candidate.text),
        reason: error,
      });
      continue;
    }

    if (isMetaLine(extracted.name)) {
      ignored.push({
        line: candidate.line,
        text: truncateForReport(candidate.text),
        reason: '看起来是报名说明而不是昵称',
      });
      continue;
    }

    // “+1 / 加一”这类暗号没有昵称信息，各自代表一个人，同样不参与去重。
    const name = isPlusOnePlaceholder(extracted.name)
      ? PLUS_ONE_NAME
      : extracted.name;
    const anonymous = name === PLUS_ONE_NAME;

    // 纯表情昵称不做去重：群里几个人各发一个 👍 都是独立的报名者。
    const baseKey = anonymous ? null : dedupeKey(name);
    if (baseKey === null) {
      players.push({
        name,
        isFemale: extracted.isFemale,
        sourceLine: candidate.line,
      });
      continue;
    }

    // 代接龙场景：同名但 🌹 不同，视为两位报名者。
    const key = `${baseKey}::${extracted.isFemale ? 'f' : 'm'}`;
    const existing = seen.get(key);

    if (existing) {
      existing.lines.push(candidate.line);
      continue;
    }

    seen.set(key, { name, lines: [candidate.line] });
    players.push({
      name,
      isFemale: extracted.isFemale,
      sourceLine: candidate.line,
    });
  }

  const duplicates: DuplicateEntry[] = [];
  for (const entry of seen.values()) {
    if (entry.lines.length > 1) {
      duplicates.push({ name: entry.name, lines: entry.lines });
    }
  }

  return {
    players,
    duplicates,
    ignored,
    mode,
    totalLines: lines.length,
  };
}

export interface EventHints {
  date?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 从接龙文本中提取时间、日期、场馆建议值。
 * 只作为建议，界面上由用户决定是否套用。
 */
export function extractHints(input: string): EventHints {
  const text = input.replace(/\r\n?/g, '\n');
  const hints: EventHints = {};

  const venueMatch = /^(?:地点|场馆|场地)\s*[:：]\s*(.+)$/mu.exec(text);
  if (venueMatch?.[1]) {
    hints.venue = venueMatch[1].trim().slice(0, 40);
  }

  const dateMatch =
    /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/u.exec(text) ??
    /(\d{1,2})月(\d{1,2})日/u.exec(text);

  if (dateMatch) {
    if (dateMatch.length === 4) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const day = Number(dateMatch[3]);
      if (year > 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        hints.date = `${year}-${pad(month)}-${pad(day)}`;
      }
    } else {
      const now = new Date();
      const month = Number(dateMatch[1]);
      const day = Number(dateMatch[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        hints.date = `${now.getFullYear()}-${pad(month)}-${pad(day)}`;
      }
    }
  }

  const timeMatch =
    /(\d{1,2})[:：](\d{2})\s*[-–—~至]\s*(\d{1,2})[:：](\d{2})/u.exec(text);
  if (timeMatch) {
    const startHour = Number(timeMatch[1]);
    const startMinute = Number(timeMatch[2]);
    const endHour = Number(timeMatch[3]);
    const endMinute = Number(timeMatch[4]);
    if (
      startHour <= 23 &&
      endHour <= 23 &&
      startMinute <= 59 &&
      endMinute <= 59
    ) {
      const start = `${pad(startHour)}:${pad(startMinute)}`;
      const end = `${pad(endHour)}:${pad(endMinute)}`;
      if (start < end) {
        hints.startTime = start;
        hints.endTime = end;
      }
    }
  }

  return hints;
}
