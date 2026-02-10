import { useEffect, useMemo, useState } from 'react';
import { ensureIso3166Data, getAllCountries, resolveIso3166CsvUrl, type CountryRecord } from '@hierarchidb/gen-iso3166-2/browser';
import type { Country, ContinentCode } from '../types/Country.js';

type State =
  | { status: 'loading'|'ready'; countries: Country[] }
  | { status: 'error'; message: string };

export interface UseIsoCountriesOptions {
  /**
   * CSV URL for ISO-3166-2 level1 data. Defaults to '/iso3166-2-level1.csv'.
   */
  csvUrl?: string;
}

const DEFAULT_CSV_URL = resolveIso3166CsvUrl();

const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
};

const resolveCandidateCsvUrls = (preferredUrl?: string): string[] => {
  const urls = new Set<string>();
  const add = (value?: string) => {
    if (!value || value.length === 0) return;
    urls.add(value);
  };
  add(preferredUrl);
  if (typeof window !== 'undefined') {
    const hintedBase = (window as Window & { __HDB_APP_BASE__?: unknown }).__HDB_APP_BASE__;
    if (typeof hintedBase === 'string' && hintedBase.length > 0) {
      add(`${normalizeBasePath(hintedBase)}iso3166-2-level1.csv`);
    }
  }
  add('/iso3166-2-level1.csv');
  return Array.from(urls);
};

const normalizeContinent = (location: string | undefined): ContinentCode => {
  const trimmed = (location ?? '').trim();
  if (!trimmed) return 'XX';
  const lower = trimmed.toLowerCase();
  const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

  if (includesAny(lower, ['africa']) || includesAny(trimmed, ['\u30a2\u30d5\u30ea\u30ab'])) return 'AF';
  if (includesAny(lower, ['asia', 'middle east']) || includesAny(trimmed, ['\u30a2\u30b8\u30a2', '\u4e2d\u6771'])) return 'AS';
  if (includesAny(lower, ['europe']) || includesAny(trimmed, ['\u30e8\u30fc\u30ed\u30c3\u30d1', '\u6b27\u5dde'])) return 'EU';
  if (includesAny(lower, ['south america']) || includesAny(trimmed, ['\u5357\u30a2\u30e1\u30ea\u30ab', '\u4e2d\u5357\u30a2\u30e1\u30ea\u30ab'])) return 'SA';
  if (includesAny(lower, ['north america', 'central america', 'caribbean', 'americas', 'america'])
    || includesAny(trimmed, ['\u5317\u30a2\u30e1\u30ea\u30ab', '\u4e2d\u592e\u30a2\u30e1\u30ea\u30ab', '\u30a2\u30e1\u30ea\u30ab'])) return 'NA';
  if (includesAny(lower, ['oceania', 'australia']) || includesAny(trimmed, ['\u30aa\u30bb\u30a2\u30cb\u30a2', '\u5927\u6d0b\u5dde'])) return 'OC';
  if (includesAny(lower, ['antarctica']) || includesAny(trimmed, ['\u5357\u6975', '\u5357\u6975\u5927\u9678'])) return 'AN';
  if (includesAny(lower, ['russia', 'mediterranean', 'indian ocean'])) return 'EU';
  return 'XX';
};

export function useIsoCountries(options: UseIsoCountriesOptions = {}) {
  const [state, setState] = useState<State>({ status: 'loading', countries: [] });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const candidateUrls = resolveCandidateCsvUrls(options.csvUrl ?? DEFAULT_CSV_URL);
        let records: CountryRecord[] = [];
        let lastError: unknown;
        for (const candidateUrl of candidateUrls) {
          try {
            await ensureIso3166Data({ csvUrl: candidateUrl });
            if (cancelled) return;
            records = await getAllCountries();
            if (cancelled) return;
            if (records.length > 0) break;
            lastError = new Error(`No ISO country records loaded from ${candidateUrl}`);
          } catch (error) {
            lastError = error;
          }
        }
        if (records.length === 0) {
          if (lastError instanceof Error) throw lastError;
          throw new Error('Failed to load ISO country records');
        }
        const countries: Country[] = records.map((rec) => ({
          code: rec.alpha2,
          name: rec.countryEn,
          nativeName: rec.countryEn,
          continent: normalizeContinent(rec.location),
        }));
        setState({ status: 'ready', countries });
      } catch (e) {
        if (cancelled) return;
        const ee: {message: string} = e as {message: string};
        setState({
          status: 'error',
          message: typeof ee.message === 'string' ? ee.message : String(e),
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [options.csvUrl]);

  const readyCountries = useMemo(() => {
    return state.status === 'ready' ? state.countries : [];
  }, [state]);

  return state.status === 'ready' ? { status: 'ready', countries: readyCountries } : {...state, countries: []};
}
