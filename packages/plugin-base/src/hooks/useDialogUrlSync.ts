/**
 * useDialogUrlSync
 * - Synchronize dialog atoms (step, mode, map) with URL query/hash.
 * - Debounced writes for high-frequency updates (map).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type DialogModeState = 'full' | 'maximize' | 'normal';

export interface DialogMapState {
  lng: number;
  lat: number;
  zoom: number;
}

export interface UseDialogUrlSyncOptions {
  namespace?: string; // prefix for params, default: '' (no prefix)
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

function debounceFn<TArgs extends unknown[]>(fn: (...args: TArgs) => void, wait: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function useDialogUrlSync(options: UseDialogUrlSyncOptions = {}) {
  const { namespace = '', defaults, debounce, history, readFrom = 'search' } = options;

  const [step, setStep] = useState<number>(defaults?.step ?? 0);
  const [mode, setMode] = useState<DialogModeState>(defaults?.mode ?? 'normal');
  const [map, setMap] = useState<DialogMapState | undefined>(defaults?.map);

  const writingRef = useRef(false);

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  const hasDialogParams = useCallback(
    (q: URLSearchParams) => {
      const ns = (k: string) => (namespace ? `${namespace}_${k}` : k);
      return q.has(ns('step')) || q.has(ns('mode')) || q.has(ns('map'));
    },
    [namespace]
  );

  const makeParams = useCallback(() => {
    if (!isBrowser) return new URLSearchParams();
    if (readFrom === 'hash') {
      const hash = window.location.hash;
      const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
      return new URLSearchParams(queryPart);
    }
    return new URLSearchParams(window.location.search);
  }, [isBrowser, readFrom]);

  const getDialogPathState = useCallback(() => {
    if (!isBrowser || namespace) return null;
    const hash = window.location.hash ?? '';
    const usesHashRouting = hash.startsWith('#/');
    const pathWithQuery = usesHashRouting ? hash.slice(1) : window.location.pathname;
    const [pathOnly] = pathWithQuery.split('?');
    const normalizedPath = pathOnly?.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const segments = normalizedPath.split('/').filter(Boolean);
    const tIndex = segments.indexOf('t');
    if (tIndex < 0 || segments.length < tIndex + 7) return null;
    const modeCandidate = segments[tIndex + 6];
    const nextModeCandidate = segments[tIndex + 7];
    const nextStepCandidate = segments[tIndex + 8];
    const parseMode = (value?: string) =>
      value === 'full' || value === 'maximize' || value === 'normal' ? value : undefined;
    let modeIndex = tIndex + 6;
    let stepIndex = tIndex + 7;
    let parsedMode = parseMode(modeCandidate);
    let parsedStep = nextModeCandidate !== undefined ? Number(nextModeCandidate) : undefined;
    if (!parsedMode && nextModeCandidate) {
      parsedMode = parseMode(nextModeCandidate);
      modeIndex = tIndex + 7;
      stepIndex = tIndex + 8;
      parsedStep = nextStepCandidate !== undefined ? Number(nextStepCandidate) : undefined;
    }
    if (!parsedMode && !nextModeCandidate) {
      modeIndex = tIndex + 7;
      stepIndex = tIndex + 8;
    }
    return {
      usesHashRouting,
      segments,
      tIndex,
      modeIndex,
      stepIndex,
      mode: parsedMode,
      step: Number.isFinite(parsedStep) ? parsedStep : undefined,
    };
  }, [isBrowser, namespace]);

  const readUrl = useCallback(() => {
    if (!isBrowser) return;
    const dialogPath = getDialogPathState();
    if (dialogPath?.mode) {
      setMode(dialogPath.mode as DialogModeState);
    }
    if (typeof dialogPath?.step === 'number') {
      setStep(dialogPath.step);
    }
    if (dialogPath) {
      const q = makeParams();
      const mp = q.get('map');
      if (mp) {
        const parts = mp.split(',');
        if (parts.length === 3) {
          const [lngStr, latStr, zoomStr] = parts as [string, string, string];
          const lng = Number(lngStr);
          const lat = Number(latStr);
          const zoom = Number(zoomStr);
          if ([lng, lat, zoom].every((v) => Number.isFinite(v))) {
            setMap({ lng, lat, zoom });
          }
        }
      }
      return;
    }
    let q = makeParams();
    if (readFrom === 'hash' && !hasDialogParams(q)) {
      const fallback = new URLSearchParams(window.location.search);
      if (hasDialogParams(fallback)) {
        q = fallback;
      }
    }
    const ns = (k: string) => (namespace ? `${namespace}_${k}` : k);
    const s = q.get(ns('step'));
    if (s !== null) {
      const n = Number(s);
      if (Number.isFinite(n)) setStep(n);
    }
    const m = q.get(ns('mode')) as DialogModeState | null;
    if (m === 'full' || m === 'maximize' || m === 'normal') setMode(m);
    const mp = q.get(ns('map'));
    if (mp) {
      const parts = mp.split(',');
      if (parts.length === 3) {
        const [lngStr, latStr, zoomStr] = parts as [string, string, string];
        const lng = Number(lngStr);
        const lat = Number(latStr);
        const zoom = Number(zoomStr);
        if ([lng, lat, zoom].every((v) => Number.isFinite(v))) {
          setMap({ lng, lat, zoom });
        }
      }
    }
  }, [isBrowser, makeParams, namespace]);

  useEffect(() => {
    // Initialize from URL once
    readUrl();
  }, [readUrl]);

  const writeUrl = useCallback(
    (
      fields: { step?: number; mode?: DialogModeState; map?: DialogMapState },
      which: 'step' | 'mode' | 'map'
    ) => {
      if (!isBrowser) return;
      const dialogPath = getDialogPathState();
      const ns = (k: string) => (namespace ? `${namespace}_${k}` : k);
      const url = new URL(window.location.href);
      const q = (() => {
        if (readFrom === 'hash') {
          const hash = url.hash ?? '';
          const [, query = ''] = hash.split('?');
          return new URLSearchParams(query);
        }
        return new URLSearchParams(url.search);
      })();

      if (dialogPath && !namespace) {
        const currentMode = dialogPath.mode ?? fields.mode ?? 'normal';
        const currentStep = dialogPath.step ?? fields.step ?? defaults?.step ?? 1;
        const modeValue = fields.mode ?? currentMode ?? 'normal';
        const stepValue = Math.max(fields.step ?? currentStep ?? 1, 1);
        const baseSegments = dialogPath.segments.slice(0, dialogPath.modeIndex);
        const nextSegments = [...baseSegments, modeValue, String(stepValue)];
        const nextPath = `/${nextSegments.join('/')}`;

        if (dialogPath.usesHashRouting) {
          const [, query = ''] = (url.hash ?? '').split('?');
          const hashParams = new URLSearchParams(query);
          hashParams.delete('step');
          hashParams.delete('mode');
          if (fields.map) {
            const { lng, lat, zoom } = fields.map;
            hashParams.set('map', `${lng.toFixed(6)},${lat.toFixed(6)},${zoom.toFixed(2)}`);
          }
          const queryString = hashParams.toString();
          url.hash = `#${nextPath}${queryString.length > 0 ? `?${queryString}` : ''}`;
        } else {
          url.pathname = nextPath;
          if (fields.map) {
            const { lng, lat, zoom } = fields.map;
            q.set('map', `${lng.toFixed(6)},${lat.toFixed(6)},${zoom.toFixed(2)}`);
          }
          q.delete('step');
          q.delete('mode');
          url.search = q.toString();
        }
      } else {
        if (fields.step != null) q.set(ns('step'), String(fields.step));
        if (fields.mode) q.set(ns('mode'), fields.mode);
        if (fields.map) {
          const { lng, lat, zoom } = fields.map;
          q.set(ns('map'), `${lng.toFixed(6)},${lat.toFixed(6)},${zoom.toFixed(2)}`);
        }

        if (readFrom === 'hash') {
          const [head] = (url.hash ?? '').split('?');
          const base = head && head.length > 0 ? head : '#';
          const queryString = q.toString();
          url.hash = queryString.length > 0 ? `${base}?${queryString}` : base;
          const search = new URLSearchParams(url.search);
          search.delete(ns('step'));
          search.delete(ns('mode'));
          search.delete(ns('map'));
          url.search = search.toString();
        } else {
          url.search = q.toString();
        }
      }

      writingRef.current = true;
      const method =
        which === 'step'
          ? history?.step === 'push'
            ? 'pushState'
            : 'replaceState'
          : 'replaceState';
      window.history[method](null, '', url);
      // next tick to ignore own popstate
      setTimeout(() => {
        writingRef.current = false;
      }, 0);
    },
    [defaults?.step, getDialogPathState, history?.step, isBrowser, namespace, readFrom]
  );

  // atoms -> URL (step, immediate)
  useEffect(() => {
    writeUrl({ step }, 'step');
  }, [step, writeUrl]);

  // atoms -> URL (mode, immediate replace)
  useEffect(() => {
    writeUrl({ mode }, 'mode');
  }, [mode, writeUrl]);

  // atoms -> URL (map, debounced)
  const debouncedWriteMap = useMemo(
    () => debounceFn((m: DialogMapState) => writeUrl({ map: m }, 'map'), debounce?.map ?? 400),
    [writeUrl, debounce?.map]
  );
  useEffect(() => {
    if (map) debouncedWriteMap(map);
  }, [map, debouncedWriteMap]);

  // URL -> atoms on back/forward
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
    const ns = namespace ? `${namespace}_` : '';
    if (readFrom === 'hash') {
      const [head] = (url.hash ?? '').split('?');
      const base = head && head.length > 0 ? head : '#';
      url.hash = base;
    } else {
      const q = new URLSearchParams(url.search);
      if (ns) {
        [...q.keys()].forEach((k) => {
          if (k.startsWith(ns)) q.delete(k);
        });
        url.search = q.toString();
      } else {
        q.delete('step');
        q.delete('mode');
        q.delete('map');
        url.search = q.toString();
      }
    }
    window.history.replaceState(null, '', url);
  }, [isBrowser, namespace, readFrom]);

  return { step, setStep, mode, setMode, map, setMap, clearParams };
}
