@hierarchidb/route-resolver
===========================

Specification-only package (no implementation yet) for a shared shortest-path resolver (WebGPU-first, CPU/WASM fallback) to be used by searoute and route plugins.

## Goal
- Provide APSP/multi-source routing over weighted graphs with pluggable ports (graph in, block-store out).
- Serve searoute (maritime) and land-route plugins with one resolver API.

## Planned architecture (spec)
- Services: `ResolverService` (`runAPSP`, `getStatus`, `cancel`, `queryDistance`, `queryPath`).
- Ports: `GraphPort` (CSR/edge access), `StorePort` (block persistence for distance/nextHop), `GPUPort`.
- Algorithms: blocked Floyd–Warshall for dense/small graphs; parallel multi-source Dijkstra (Δ-stepping) for sparse/large graphs; hybrid selection.

## Data model (spec)
- Inputs: weighted directed/undirected graphs; node dictionary; CSR buffers for GPU.
- Outputs: distance blocks, nextHop/predecessor tables, metadata (blockSize, algo, version, checksum).

## Consumers
- `@hierarchidb/route-searoute` (maritime) and route plugins plan to call this once implemented.

## Status
- Specification only; implementation to be staged (GPU kernels, Dexie storage, query API).
