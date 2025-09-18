export function useQuery<T = any>(_opts?: any): { isLoading: boolean; data: T; error?: unknown } {
  return { isLoading: false, data: null as any as T };
}
