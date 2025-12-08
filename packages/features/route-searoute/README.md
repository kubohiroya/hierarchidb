@hierarchidb/route-searoute
===========================

Specification-only package (no implementation yet) for maritime routing. Builds a simplified sea graph (ports + straits/canals + grid) and returns routes as ordered segment IDs.

## Goal
- On-demand routing between ports without full APSP precompute; A* / Dijkstra with great-circle heuristic.
- Separation from rendering: map drawing handled by map-adapter; this package resolves segment IDs only.

## Planned architecture (spec)
- Data ingest: fetch ports/straits/canals, generate sea grid, store segments/adjacency in Dexie.
- Router: `planRoute(fromPortId, toPortId, opts)` → `{ segments, distanceKm }`.
- Ports: `DataSourcePort`, `StorePort`, `RouterPort`.

## Data model (spec)
- Nodes: ports and grid nodes (lon/lat).
- Edges: segments with `fromId`, `toId`, `lengthKm`, `type` (`strait|canal|grid|port-link`), `coords`.
- Adjacency stored for fast traversal; options to avoid canals/straits, set max hops.

## Consumers
- Intended to pair with `@hierarchidb/route-resolver` once implemented; UIs/plugins will call this resolver for sea routes.

## Status
- Specification only; implementation to follow staged plan (ingest → router → optimization).
