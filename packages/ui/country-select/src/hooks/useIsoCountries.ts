import { useEffect, useMemo, useState } from 'react';
import { ensureIso3166Data, getAllCountries, type CountryRecord } from '@hierarchidb/gen-iso3166-2/browser';
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

const DEFAULT_CSV_URL = '/iso3166-2-level1.csv';

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
        await ensureIso3166Data({
          csvUrl: options.csvUrl ?? DEFAULT_CSV_URL,
        });
        if (cancelled) return;
        const records: CountryRecord[] = await getAllCountries();
        if (cancelled) return;
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
