export const sanitizeForComlink = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (typeof value === 'bigint') {
    return value.toString() as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? undefined,
    } as T;
  }

  if (value instanceof Map) {
    return Array.from(value.values()).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (value instanceof Set) {
    return Array.from(value).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  const safe = {} as Record<string, unknown>;
  seen.set(value as object, safe);

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const rawValue = (value as Record<string, unknown>)[key];
    if (typeof rawValue === 'function' || typeof rawValue === 'symbol') {
      continue;
    }
    safe[key] = sanitizeForComlink(rawValue, seen);
  }

  return safe as T;
};
