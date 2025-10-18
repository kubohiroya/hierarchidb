export interface ShapeProgressState {
  progress: null;
  status: null;
  isSubscribed: boolean;
  error: Error | null;
}

export interface UseShapeProgressOptions {
  autoSubscribe?: boolean;
}

export function useShapeProgress(_sessionId: string | null, _options: UseShapeProgressOptions = {}) {
  return {
    progress: null,
    status: null,
    isSubscribed: false,
    error: null,
    subscribe: () => undefined,
    unsubscribe: () => undefined,
    refresh: async () => undefined,
  } as const;
}
