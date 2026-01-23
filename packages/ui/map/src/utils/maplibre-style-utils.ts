export const normalizePaintLiteralArrays = (paint: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(paint).map(([key, value]) => {
      if (!Array.isArray(value)) return [key, value];
      if (value.length === 0) return [key, value];
      if (typeof value[0] === 'string') return [key, value];
      return [key, ['literal', value]];
    }),
  );
};
