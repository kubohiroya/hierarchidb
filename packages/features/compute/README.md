@hierarchidb/compute
====================

Worker-pool and task execution feature. Provides a minimal, portable execution layer (Facade + basic pool) to run CPU-bound steps with cancellation and progress, and to back higher-level batch orchestration.

Design goals
------------
- Simple default pool (in-thread executor today; WebWorker-backed in future) with stable Task API.
- Decouple scheduling/execution from business logic.

Architecture
------------
- Facade: `ComputeService` with an internal `WorkerPool`
- Ports: `WorkerEnvPort`, `ClockPort` (future: real Worker integration)
- Types: `TaskSpec`, `TaskHandle`, `TaskStatus`

Quick start
-----------
```ts
import { ComputeService } from '@hierarchidb/compute';

const compute = new ComputeService({ concurrency: 3 });
const handle = compute.submit({ input: 21, fn: async (x, signal, report) => { report(50); return x * 2; } });
handle.onProgress(p => console.log('progress', p));
const out = await handle.result();
```

Notes
-----
- Current implementation runs tasks in-thread (no real Workers yet) to provide a stable API surface. It is a drop-in once WorkerEnvPort is provided.
- Cancellation uses `AbortController`; your functions should observe `signal`.

Roadmap
-------
- Browser WebWorker + module URL pool via `WorkerEnvPort`
- Retry policies and priorities
- Resource-aware scheduling (CPU time budgets)

