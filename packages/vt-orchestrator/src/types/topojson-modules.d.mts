declare module 'topojson-server' {
  import type { Topology } from 'topojson-specification';
  export function topology(objects: Record<string, unknown>): Topology;
}

declare module 'topojson-simplify' {
  import type { Topology } from 'topojson-specification';
  export function presimplify(topology: Topology): Topology;
  export function simplify(topology: Topology, minWeight?: number): Topology;
}

