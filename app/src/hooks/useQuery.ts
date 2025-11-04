import { useEffect, useMemo, useRef, useState } from 'react';

type QueryKey = unknown;

export type QueryOptions<T> = {
  queryKey?: QueryKey;
  queryFn?: () => Promise<T>;
  initialData?: T;
  enabled?: boolean;
};

export type QueryResult<T> = {
  isLoading: boolean;
  data: T;
  error?: unknown;
};

export function useQuery<T>(options: QueryOptions<T>): QueryResult<T> {
  const { queryFn, initialData, enabled = true } = options;
  const [state, setState] = useState<QueryResult<T>>(() => ({
    isLoading: Boolean(queryFn && enabled),
    data: initialData as T,
    error: undefined,
  }));

  const key = useMemo(() => JSON.stringify(options.queryKey ?? null), [options.queryKey]);
  const latestKeyRef = useRef(key);

  useEffect(() => {
    latestKeyRef.current = key;
  }, [key]);

  useEffect(() => {
    let active = true;
    const runKey = key;
    if (!queryFn || !enabled) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return () => {
        active = false;
      };
    }
    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));
    queryFn()
      .then((data) => {
        if (!active || latestKeyRef.current !== runKey) return;
        setState({ isLoading: false, data, error: undefined });
      })
      .catch((error) => {
        if (!active || latestKeyRef.current !== runKey) return;
        setState((prev) => ({ ...prev, isLoading: false, error }));
      });
    return () => {
      active = false;
    };
  }, [key, queryFn, enabled]);

  return state;
}
