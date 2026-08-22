export type RouteGeometryBandValuesParseError =
  | { kind: 'bandCount'; expectedCount: number }
  | { kind: 'valueCount'; expectedCount: number; actualCount: number }
  | { kind: 'invalidValue'; index: number };

export type RouteGeometryBandValuesParseResult =
  | { ok: true; values: number[] }
  | { ok: false; error: RouteGeometryBandValuesParseError };

export const parseRouteGeometryBandValues = (
  raw: string,
  expectedCount: number
): RouteGeometryBandValuesParseResult => {
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    return { ok: false, error: { kind: 'bandCount', expectedCount } };
  }
  const entries = raw.split(',');
  if (entries.length !== expectedCount) {
    return {
      ok: false,
      error: { kind: 'valueCount', expectedCount, actualCount: entries.length },
    };
  }
  const values: number[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === undefined || entry.trim().length === 0) {
      return { ok: false, error: { kind: 'invalidValue', index } };
    }
    const value = Number(entry.trim());
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: { kind: 'invalidValue', index } };
    }
    values.push(value);
  }
  return { ok: true, values };
};
