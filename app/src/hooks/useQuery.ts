import { useEffect, useState } from 'react';

type UseQueryOptions<T> = {
  queryKey?: unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
};

type UseQueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

export function useQuery<T>({ queryFn, enabled = true }: UseQueryOptions<T>): UseQueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    queryFn()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { data, isLoading, error };
}

