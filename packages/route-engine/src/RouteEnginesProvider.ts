export interface RouteEnginesProvider {
  osrm?: {
    route: (
      points: [number, number][],
      options?: unknown
    ) => Promise<{
      line: [number, number][];
      distance_m: number;
      duration_s?: number;
    }>;
  };
  searoute?: {
    route: (
      points: [number, number][],
      options?: unknown
    ) => Promise<{
      line: [number, number][];
      distance_m: number;
      duration_s?: number;
    }>;
  };
  custom?: {
    route: (
      points: [number, number][],
      options?: unknown
    ) => Promise<{
      line: [number, number][];
      distance_m: number;
      duration_s?: number;
    }>;
  };
}
