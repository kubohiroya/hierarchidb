@hierarchidb/batch
===================

High-level batch orchestration on top of `@hierarchidb/compute`. Includes minimal `mapChunks` today and is designed to grow into pipelines/DAGs with checkpointing and resume.

Design intent
-------------
- Make parallel map/reduce style processing easy and predictable (concurrency caps, progress).
- Keep storage/environment pluggable via ports (checkpointing later).

Architecture
------------
- Facade: `BatchService`
  - `mapChunks(source, fn, { concurrency, progress })` → Promise<O[]>
- Port (future): `CheckpointPort` to persist intermediate progress/state

Quick start
-----------
```ts
import { BatchService } from '@hierarchidb/batch';

const batch = new BatchService();
const res = await batch.mapChunks([1,2,3,4], async (n) => n * 2, { concurrency: 2, progress: c => console.log(c) });
```

Integration
-----------
- Combine with `@hierarchidb/download` for URL lists and `@hierarchidb/compute` for CPU steps.

Roadmap
-------
- Pipelines with fan-out/fan-in
- DAG execution with per-node concurrency
- Checkpointing + resume via `CheckpointPort`

