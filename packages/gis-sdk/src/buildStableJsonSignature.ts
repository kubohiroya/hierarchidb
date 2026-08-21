type Primitive = string | number | boolean | null;

const isPrimitive = (value: unknown): value is Primitive => (
  value === null
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean'
);

const sortPrimitiveArray = (values: Primitive[]): Primitive[] => (
  [...values].sort((a, b) => {
    const typeA = a === null ? 'null' : typeof a;
    const typeB = b === null ? 'null' : typeof b;
    if (typeA !== typeB) return typeA < typeB ? -1 : 1;
    if (a === b) return 0;
    return String(a) < String(b) ? -1 : 1;
  })
);

const normalizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const normalizedItems = value.map((item) => normalizeValue(item));
    if (normalizedItems.every(isPrimitive)) {
      return sortPrimitiveArray(normalizedItems as Primitive[]);
    }
    return normalizedItems;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const normalized: Record<string, unknown> = {};
    entries.forEach(([key, entryValue]) => {
      normalized[key] = normalizeValue(entryValue);
    });
    return normalized;
  }
  return value;
};

export const buildStableJsonSignature = (value: unknown): string => (
  JSON.stringify(normalizeValue(value ?? null))
);
