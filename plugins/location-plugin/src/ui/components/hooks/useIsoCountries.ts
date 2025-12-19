import { useEffect, useState } from 'react';
import {
  ensureIso3166Data,
  getAllCountries,
  type CountryRecord,
} from '@hierarchidb/gen-iso3166-2';

type State =
  | { status: 'loading' }
  | { status: 'ready'; countries: CountryRecord[] }
  | { status: 'error'; message: string };

export interface UseIsoCountriesOptions {
  /**
   * CSV 配置パス。Vite プラグインで生成した CSV を参照することを想定。
   * 例: '/iso3166-2-level1.csv'
   */
  csvUrl?: string;
}

const DEFAULT_CSV_URL = '/iso3166-2-level1.csv';

export function useIsoCountries(options: UseIsoCountriesOptions = {}) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await ensureIso3166Data({
          csvUrl: options.csvUrl ?? DEFAULT_CSV_URL,
          useScraper: false, // ブラウザではスクレイプしない。ビルド時生成の CSV から永続化。
        });
        if (cancelled) return;
        const countries = await getAllCountries();
        if (cancelled) return;
        setState({ status: 'ready', countries });
      } catch (e: any) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: typeof e?.message === 'string' ? e.message : String(e),
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [options.csvUrl]);

  return state;
}
