import { ensureIso3166Data, getCountry, type EnsureIsoOptions } from '@hierarchidb/gen-iso3166-2/browser';

export type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC' | 'AN' | 'XX';

export const DEFAULT_ISO3166_CSV_URL = '/iso3166-2-level1.csv';

const CONTINENT_NAMES: Record<ContinentCode, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  OC: 'Oceania',
  AN: 'Antarctica',
  XX: 'N/A',
};

const resolveContinentCodeFromLocation = (location?: string): ContinentCode => {
  const trimmed = (location ?? '').trim();
  if (!trimmed) return 'XX';
  const upper = trimmed.toUpperCase();
  if (upper in CONTINENT_NAMES) {
    return upper as ContinentCode;
  }
  if (upper === 'N/A' || upper === 'UNKNOWN') return 'XX';
  const lower = trimmed.toLowerCase();
  const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

  if (includesAny(lower, ['africa']) || includesAny(trimmed, ['アフリカ'])) return 'AF';
  if (includesAny(lower, ['asia', 'middle east']) || includesAny(trimmed, ['アジア', '中東'])) return 'AS';
  if (includesAny(lower, ['europe']) || includesAny(trimmed, ['ヨーロッパ', '欧州'])) return 'EU';
  if (includesAny(lower, ['south america']) || includesAny(trimmed, ['南アメリカ', '中南アメリカ'])) return 'SA';
  if (includesAny(lower, ['north america', 'central america', 'caribbean', 'americas', 'america'])
    || includesAny(trimmed, ['北アメリカ', '中央アメリカ', 'アメリカ'])) return 'NA';
  if (includesAny(lower, ['oceania', 'australia']) || includesAny(trimmed, ['オセアニア', '大洋州'])) return 'OC';
  if (includesAny(lower, ['antarctica']) || includesAny(trimmed, ['南極', '南極大陸'])) return 'AN';
  if (includesAny(lower, ['russia', 'mediterranean', 'indian ocean'])) return 'EU';
  return 'XX';
};

export const normalizeContinentCode = (value?: string): ContinentCode | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return resolveContinentCodeFromLocation(trimmed);
};

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

export async function resolveCountryContinentName(
  code: string,
  options?: EnsureIsoOptions,
): Promise<string> {
  const trimmed = code.trim();
  if (!trimmed) return CONTINENT_NAMES.XX;
  await ensureIso3166Data({ csvUrl: DEFAULT_ISO3166_CSV_URL, ...options });
  const result = await getCountry(trimmed.toUpperCase());
  const location = result?.country?.location;
  const resolved = resolveContinentCodeFromLocation(location);
  return CONTINENT_NAMES[resolved] ?? CONTINENT_NAMES.XX;
}

export async function resolveCountryContinentCode(
  code: string,
  options?: EnsureIsoOptions,
): Promise<ContinentCode> {
  const trimmed = code.trim();
  if (!trimmed) return 'XX';
  await ensureIso3166Data({ csvUrl: DEFAULT_ISO3166_CSV_URL, ...options });
  const result = await getCountry(trimmed.toUpperCase());
  return resolveContinentCodeFromLocation(result?.country?.location);
}

export const getContinentNameFromCode = (code: ContinentCode): string => (
  CONTINENT_NAMES[code] ?? CONTINENT_NAMES.XX
);
