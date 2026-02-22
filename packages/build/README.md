@hierarchidb/batch
===================

Lightweight build orchestration with a minimal `mapChunks` helper; designed to evolve toward pipelines/DAGs with checkpointing.

Build* names are canonical.

## Directory layout
```
index.ts          Public exports
```

## Key exports
- `BuildService`
  - `mapChunks(source, fn, { concurrency, progress })` — parallel map with progress + abort support.

## Consumers / usage
- Compose with `@hierarchidb/download` to process URL lists.
- Plugins (e.g., route/shape) can wrap long-running steps with `mapChunks`.

## Notes / roadmap
- Future: checkpoint/resume via `CheckpointPort`, DAG fan-out/fan-in, priorities.
