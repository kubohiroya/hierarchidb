/**
 * Parses an environment-provided integer string using base 10.
 * Falls back to the provided default when the value is undefined or invalid.
 */
export function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
