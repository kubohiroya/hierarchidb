export type EngineMethod = 'direct' | 'great_circle' | 'osm_route' | 'searoute';
export type TransportMode = 'road_general' | 'road_express' | 'rail' | 'rail_highspeed' | 'sea' | 'air';

export interface OdPair {
  start: { lon: number; lat: number };
  end: { lon: number; lat: number };
  mode?: TransportMode;
  engine?: EngineMethod;
  metadata?: Record<string, any>;
}

export interface DataSourceSpec {
  type: 'csv' | 'geojson' | 'api';
  url?: string;
  inline?: string; // for tests or pasted input
  options?: Record<string, any>;
}

export interface RouteBatchSpec {
  sources: DataSourceSpec[];
  defaults?: { engine?: EngineMethod; mode?: TransportMode };
}

export interface FetchTask {
  kind: 'fetch';
  url: string;
  opts?: RequestInit;
}

export interface ParseTask {
  kind: 'parse';
  source: 'csv' | 'geojson';
  payloadRef: string;
}

export interface TaskPlan {
  fetch: FetchTask[];
  parse: ParseTask[];
}

export interface StrategyContext {
  planId: string;
}

export interface DataSourceStrategy {
  supports(spec: DataSourceSpec): boolean;

  plan(spec: DataSourceSpec, ctx: StrategyContext): Promise<TaskPlan>;

  executeParse(task: ParseTask, blobs: Map<string, Blob>, defaults?: RouteBatchSpec['defaults']): Promise<OdPair[]>;
}

