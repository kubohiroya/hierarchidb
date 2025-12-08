@hierarchidb/batch
===================

Lightweight batch orchestration on top of `@hierarchidb/compute`. Currently offers a minimal `mapChunks` helper; designed to evolve toward pipelines/DAGs with checkpointing.

## Directory layout
```
BatchService.ts   Facade
index.ts          Public exports + FeatureDefinition
```

## Key exports
- `BatchService`
  - `mapChunks(source, fn, { concurrency, progress })` — parallel map with progress + abort support.
- `FeatureDefinition.manifest` (`provides: ['batch']`).

## Consumers / usage
- Pair with `@hierarchidb/compute` for task execution; compose with `@hierarchidb/download` to process URL lists.
- Plugins (e.g., route/shape) can wrap long-running steps with `mapChunks`.

## Notes / roadmap
- Future: checkpoint/resume via `CheckpointPort`, DAG fan-out/fan-in, priorities.
