export interface RoutingEngine {
  route(
    points: [number, number][],
    options?: unknown,
  ): Promise<{
    line: [number, number][];
    distance_m: number;
    duration_s?: number;
  }>;
}
