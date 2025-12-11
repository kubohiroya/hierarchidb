@hierarchidb/compute
====================

Task execution feature with a minimal pool and progress/cancellation. Currently runs in-thread but exposes a stable API to swap in real Worker environments later.

## Directory layout
```
ComputeService.ts  Facade with internal WorkerPool
batch-types.ts           TaskSpec/TaskHandle/TaskStatus
ports.ts           WorkerEnvPort, ClockPort (for future Worker-backed pools)
index.ts           Public exports + FeatureDefinition
```

## Key exports
- `ComputeService` — `submit({ input, fn, signal? })` returns `TaskHandle` with `onProgress`, `cancel`, `result`.
- Types: `TaskSpec`, `TaskHandle`, `TaskStatus`.
- Ports: `WorkerEnvPort`, `ClockPort`.
- `FeatureDefinition.manifest` (`provides: ['compute']`).

## Consumers / usage
- Used by `@hierarchidb/batch` to parallelize chunk processing.
- Plugins can wrap CPU-heavy steps (e.g., geometry transforms) and hook progress.

## Notes / roadmap
- Current executor is synchronous (no real Workers); swap in `WorkerEnvPort` to run off-thread.
- Observe `AbortSignal` in task functions for cancellation. Future work: retry/policy/priorities.
