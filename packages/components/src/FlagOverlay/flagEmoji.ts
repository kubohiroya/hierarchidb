export interface FlagSymbolOptions {
  fallbackSymbol?: string;
}

const REGIONAL_INDICATOR_BASE = 0x1f1a5;

export function normalizeIsoCode(isoCode: string): string | null {
  const normalized = isoCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function isoCodeToFlagEmoji(isoCode: string): string | null {
  const normalized = normalizeIsoCode(isoCode);
  if (!normalized) {
    return null;
  }

  const firstCodePoint = REGIONAL_INDICATOR_BASE + normalized.charCodeAt(0);
  const secondCodePoint = REGIONAL_INDICATOR_BASE + normalized.charCodeAt(1);

  return String.fromCodePoint(firstCodePoint, secondCodePoint);
}

export function resolveFlagSymbol(isoCode: string, options?: FlagSymbolOptions): string {
  const emoji = isoCodeToFlagEmoji(isoCode);
  if (emoji) {
    return emoji;
  }

  return options?.fallbackSymbol ?? '⬜';
}
