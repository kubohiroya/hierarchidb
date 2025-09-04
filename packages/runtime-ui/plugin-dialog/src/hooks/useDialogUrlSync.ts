/**
 * useDialogUrlSync
 * - Synchronize dialog state (step, mode, map) with URL query/hash.
 * - Debounced writes for high-frequency updates (map).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type DialogModeState = 'full' | 'normal';

export interface DialogMapState {
  lng: number;
  lat: number;
  zoom: number;
}

export interface UseDialogUrlSyncOptions {
  namespace?: string; // prefix for params, default: 'd'
  defaults?: {
    step?: number;
    mode?: DialogModeState;
    map?: DialogMapState;
  };
  debounce?: {
    step?: number; // usually 0 (immediate)
    map?: number; // default 400ms
  };
  history?: {
    step?: 'push' | 'replace'; // default 'push'
    mode?: 'replace'; // only replace supported for mode
    map?: 'replace'; // only replace supported for map
  };
  readFrom?: 'search' | 'hash'; // default 'search'
}

function debounceFn<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function useDialogUrlSync(options: UseDialogUrlSyncOptions = {}) {
  const {
    namespace = 'd',
    defaults,
    debounce,
    history,
    readFrom = 'search',
  } = options;

  const [step, setStep] = useState<number>(defaults?.step ?? 0);
  const [mode, setMode] = useState<DialogModeState>(defaults?.mode ?? 'normal');
  const [map, setMap] = useState<DialogMapState | undefined>(defaults?.map);

  const writingRef = useRef(false);

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  const makeParams = useCallback(() => {
    if (!isBrowser) return new URLSearchParams();
    if (readFrom === 'hash') {
      const hash = window.location.hash;
      const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
      return new URLSearchParams(queryPart);
    }
    return new URLSearchParams(window.location.search);
  }, [isBrowser, readFrom]);

  const readUrl = useCallback(() => {
    if (!isBrowser) return;
    const q = makeParams();
    const ns = (k: string) => `${namespace}_${k}`;
    const s = q.get(ns('step'));
    if (s !== null) {
      const n = Number(s);
      if (Number.isFinite(n)) setStep(n);
    }
    const m = q.get(ns('mode')) as DialogModeState | null;
    if (m === 'full' || m === 'normal') setMode(m);
    const mp = q.get(ns('map'));
    if (mp) {
      const [lng, lat, zoom] = mp.split(',').map(Number);
      if ([lng, lat, zoom].every((v) => Number.isFinite(v))) {
        setMap({ lng, lat, zoom });
      }
    }
  }, [isBrowser, makeParams, namespace]);

  useEffect(() => {
    // Initialize from URL once
    readUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writeUrl = useCallback(
    (
      fields: { step?: number; mode?: DialogModeState; map?: DialogMapState },
      which: 'step' | 'mode' | 'map'
    ) => {
      if (!isBrowser) return;
      const ns = (k: string) => `${namespace}_${k}`;
      const url = new URL(window.location.href);
      const q = readFrom === 'hash'
        ? new URLSearchParams(url.hash.includes('?') ? url.hash.split('?')[1] : '')
        : new URLSearchParams(url.search);

      if (fields.step != null) q.set(ns('step'), String(fields.step));
      if (fields.mode) q.set(ns('mode'), fields.mode);
      if (fields.map) {
        const { lng, lat, zoom } = fields.map;
        q.set(ns('map'), `${lng.toFixed(6)},${lat.toFixed(6)},${zoom.toFixed(2)}`);
      }

      if (readFrom === 'hash') {
        const base = url.hash.includes('?') ? url.hash.split('?')[0] : (url.hash || '#');
        url.hash = `${base}?${q.toString()}`;
      } else {
        url.search = q.toString();
      }

      writingRef.current = true;
      const method = which === 'step' ? (history?.step === 'push' ? 'pushState' : 'replaceState') : 'replaceState';
      window.history[method](null, '', url);
      // next tick to ignore own popstate
      setTimeout(() => {
        writingRef.current = false;
      }, 0);
    },
    [isBrowser, namespace, readFrom, history?.step]
  );

  // state -> URL (step, immediate)
  useEffect(() => {
    writeUrl({ step }, 'step');
  }, [step, writeUrl]);

  // state -> URL (mode, immediate replace)
  useEffect(() => {
    writeUrl({ mode }, 'mode');
  }, [mode, writeUrl]);

  // state -> URL (map, debounced)
  const debouncedWriteMap = useMemo(
    () => debounceFn((m: DialogMapState) => writeUrl({ map: m }, 'map'), debounce?.map ?? 400),
    [writeUrl, debounce?.map]
  );
  useEffect(() => {
    if (map) debouncedWriteMap(map);
  }, [map, debouncedWriteMap]);

  // URL -> state on back/forward
  useEffect(() => {
    if (!isBrowser) return;
    const onPop = () => {
      if (writingRef.current) return;
      readUrl();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isBrowser, readUrl]);

  const clearParams = useCallback(() => {
    if (!isBrowser) return;
    const url = new URL(window.location.href);
    const ns = `${namespace}_`;
    if (readFrom === 'hash') {
      const base = url.hash.includes('?') ? url.hash.split('?')[0] : (url.hash || '#');
      url.hash = base;
    } else {
      const q = new URLSearchParams(url.search);
      [...q.keys()].forEach((k) => { if (k.startsWith(ns)) q.delete(k); });
      url.search = q.toString();
    }
    window.history.replaceState(null, '', url);
  }, [isBrowser, namespace, readFrom]);

  return { step, setStep, mode, setMode, map, setMap, clearParams };
}

