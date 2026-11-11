const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function todayISO(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return { year, month, day };
}

export function weekdayLabel(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return '';

  const date = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  return WEEKDAYS[date.getDay()] ?? '';
}

export function formatFullCN(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return value;

  return `${parts.year}年${parts.month}月${parts.day}日 ${weekdayLabel(value)}`;
}

export function formatShortCN(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return value;

  return `${parts.month}.${parts.day} ${weekdayLabel(value)}`;
}

export function formatNumericCN(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return value;

  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start || '--:--'}–${end || '--:--'}`;
}

export function isValidTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTimeRange(start: string, end: string): boolean {
  if (!isValidTimeValue(start) || !isValidTimeValue(end)) return false;
  return start < end;
}

export function minutesFromTime(value: string): number {
  if (!isValidTimeValue(value)) return 0;
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
