let counter = 0;

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
