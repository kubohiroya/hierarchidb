export interface NetworkPortLike {
  get(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface RoutingEngine {
  route(points: [number, number][], options?: any): Promise<{ line: [number, number][], distance_m: number, duration_s?: number }>;
}

