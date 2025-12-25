import { ensureIso3166Data, getCountry, type EnsureIsoOptions } from '@hierarchidb/gen-iso3166-2';

export type IsoCodeFormat = 'iso2' | 'iso3';

export async function convertIsoCountryCode(
  code: string,
  target: IsoCodeFormat,
  options?: EnsureIsoOptions,
): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  await ensureIso3166Data(options);
  const result = await getCountry(trimmed.toUpperCase());
  if (!result?.country) return null;

  return target === 'iso3'
    ? result.country.alpha3.toUpperCase()
    : result.country.alpha2.toUpperCase();
}

export async function normalizeCountryCodeFormat(
  code: string,
  target: IsoCodeFormat,
  options?: EnsureIsoOptions,
): Promise<string> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return code;
  if (target === 'iso2' && normalized.length === 2) return normalized;
  if (target === 'iso3' && normalized.length === 3) return normalized;
  const converted = await convertIsoCountryCode(normalized, target, options);
  return converted ?? normalized;
}
