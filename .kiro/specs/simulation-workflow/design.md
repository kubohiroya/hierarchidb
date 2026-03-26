# Design Document: simulation-workflow

## Overview

`SimulationWorkflow` is a TypeScript class that orchestrates multi-step simulation
workflows against the IDE-GSM API. It wraps `IdeGsmClient` and exposes two
high-level methods:

- `runSimulation` — import → calibrate → simulate → export (ZIP-based flow)
- `runSimulationWithRsync` — rsync-push → calibrate → simulate → rsync-pull (rsync-based flow)

Both methods accept an optional `onStepChange` callback so callers can display
real-time progress in a UI.

The package is published as `@hierarchidb/simulation-workflow` under
`packages/simulation-workflow`, following the conventions of sibling packages
(`@hierarchidb/ide-gsm-client`, `@hierarchidb/yaml-api`).

### Goals

- Provide a single, composable entry point for running simulations.
- Enforce strict step ordering and error propagation — no silent fallbacks.
- Keep the class thin: all network I/O is delegated to `IdeGsmClient`.

### Non-Goals

- Retry logic or circuit-breaking (caller's responsibility).
- Caching of task results.
- Parallel step execution.

---

## Architecture

```
Caller
  │
  ▼
SimulationWorkflow
  ├── runSimulation(nodes, path, filter?, cb?)
  │     exportYamlNodesToSnapshot ──► ProjectSnapshot
  │     IdeGsmClient.importProject ──► taskId ──► awaitTask
  │     IdeGsmClient.calibrate     ──► taskId ──► awaitTask
  │     IdeGsmClient.simulate      ──► taskId ──► awaitTask
  │     IdeGsmClient.exportProject ──► taskId ──► awaitTask ──► ProjectSnapshot
  │
  └── runSimulationWithRsync(path, connType, filter?, cb?)
        IdeGsmClient.rsyncPush  ──► taskId ──► awaitTask
        IdeGsmClient.calibrate  ──► taskId ──► awaitTask
        IdeGsmClient.simulate   ──► taskId ──► awaitTask
        IdeGsmClient.rsyncPull  ──► taskId ──► awaitTask
```

`SimulationWorkflow` is a pure orchestrator. It holds no mutable state beyond
the injected `IdeGsmClient` reference.

---

## Components and Interfaces

### Package layout

```
packages/simulation-workflow/
  src/
    simulationWorkflowTypes.ts  — StepName, StepStatus, OnStepChange, RsyncFilter
    SimulationWorkflow.ts       — main class
    index.ts                    — re-export entry point
  __tests__/
    SimulationWorkflow.test.ts  — property-based tests (vitest + fast-check)
  package.json
  tsconfig.json
  tsconfig.typecheck.json
  vitest.config.ts
```

### `simulationWorkflowTypes.ts`

```ts
export type StepName =
  | 'import'
  | 'calibrate'
  | 'simulate'
  | 'export'
  | 'rsync-push'
  | 'rsync-pull';

export type StepStatus = 'running' | 'done' | 'failed';

export type OnStepChange = (step: StepName, status: StepStatus) => void;

export interface RsyncFilter {
  include?: string[];
  exclude?: string[];
}
```

### `SimulationWorkflow` (public API)

```ts
export class SimulationWorkflow {
  constructor(client: IdeGsmClient)

  runSimulation(
    nodes: readonly ExportableNode[],
    projectRelativePath: string,
    exportFilter?: ExportFilter,
    onStepChange?: OnStepChange,
  ): Promise<string>  // resolves with ProjectSnapshot

  runSimulationWithRsync(
    projectRelativePath: string,
    connectionType: 'remote' | 'ssh' | 'ec2',
    rsyncFilter?: RsyncFilter,
    onStepChange?: OnStepChange,
  ): Promise<void>
}
```

All methods throw on any error. No method swallows errors silently.

### `IdeGsmClient` extensions (in `@hierarchidb/ide-gsm-client`)

Two new mutation methods are added to the existing `IdeGsmClient` class:

```ts
rsyncPush(
  projectRelativePath: string,
  connectionType: 'remote' | 'ssh' | 'ec2',
  filter?: RsyncFilter,
): Promise<string>  // returns taskId

rsyncPull(
  projectRelativePath: string,
  connectionType: 'remote' | 'ssh' | 'ec2',
  filter?: RsyncFilter,
): Promise<string>  // returns taskId
```

---

## Data Models

### New types in `simulationWorkflowTypes.ts`

```ts
export type ConnectionType = 'remote' | 'ssh' | 'ec2';

export interface RsyncFilter {
  include?: string[];
  exclude?: string[];
}
```

### GraphQL mutations added to `IdeGsmClient`

```graphql
mutation RsyncPush($input: RsyncInput!) {
  rsyncPush(input: $input)
}

mutation RsyncPull($input: RsyncInput!) {
  rsyncPull(input: $input)
}
```

`RsyncInput` fields:
- `projectRelativePath: String!`
- `connectionType: String!` — `"remote"` | `"ssh"` | `"ec2"`
- `include: [String]` — optional
- `exclude: [String]` — optional

`include` and `exclude` are only added to the variables object when present in
`RsyncFilter`; absent fields are never sent as `null`.

### Step ordering

| Method | Step sequence |
|---|---|
| `runSimulation` | import → calibrate → simulate → export |
| `runSimulationWithRsync` | rsync-push → calibrate → simulate → rsync-pull |

Each step follows the same pattern:
1. Invoke `onStepChange(step, 'running')`
2. Call the corresponding `IdeGsmClient` mutation → get `taskId`
3. Call `awaitTask(taskId)`
4. On success: invoke `onStepChange(step, 'done')`
5. On error: invoke `onStepChange(step, 'failed')`, then re-throw


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system
should do. Properties serve as the bridge between human-readable specifications
and machine-verifiable correctness guarantees.*

### Property 1: Import flow step order invariant

*For any* successful `runSimulation` call, the `onStepChange` callbacks must be
invoked in exactly this order:
`import(running)` → `import(done)` → `calibrate(running)` → `calibrate(done)` →
`simulate(running)` → `simulate(done)` → `export(running)` → `export(done)`.
No other `onStepChange` events may appear.

**Validates: Requirements 3.2, 3.3, 4.2, 4.3, 5.2, 5.3, 6.4, 6.5, 8.1, 9.1, 9.2, 9.5**

### Property 2: Rsync flow step order invariant

*For any* successful `runSimulationWithRsync` call, the `onStepChange` callbacks
must be invoked in exactly this order:
`rsync-push(running)` → `rsync-push(done)` → `calibrate(running)` → `calibrate(done)` →
`simulate(running)` → `simulate(done)` → `rsync-pull(running)` → `rsync-pull(done)`.
No other `onStepChange` events may appear.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**

### Property 3: Error stops subsequent steps

*For any* step (in either flow) that throws an error, `onStepChange` must be
called with `'failed'` for that step, and no `onStepChange` event for any
subsequent step must be invoked.

**Validates: Requirements 3.4, 4.4, 5.4, 6.6, 8.3, 10.2, 11.7**

### Property 4: Error propagation without modification

*For any* error thrown by any `IdeGsmClient` method or `exportYamlNodesToSnapshot`,
the error caught by the caller of `runSimulation` or `runSimulationWithRsync`
must be the same error instance (or carry the same message) — no wrapping or
suppression.

**Validates: Requirements 10.1, 10.3**

### Property 5: Serialization error prevents any step execution

*For any* call to `runSimulation` where `exportYamlNodesToSnapshot` returns an
error result, `runSimulation` must throw and no `onStepChange` callback must be
invoked.

**Validates: Requirements 2.2**

### Property 6: ExportFilter passthrough

*For any* `ExportFilter` value passed to `runSimulation`, the same filter must
be forwarded unchanged to `IdeGsmClient.exportProject`.

**Validates: Requirements 6.2, 6.3**

### Property 7: Export result round-trip

*For any* successful `runSimulation` call, the returned `ProjectSnapshot` string
must equal the `paramsJson` field of the `TaskResult` resolved by `awaitTask`
for the export step.

**Validates: Requirements 7.1**

### Property 8: Rsync mutation taskId passthrough

*For any* `rsyncPush` or `rsyncPull` call and *for any* `taskId` string returned
by the mocked server, the value returned by the method must equal the `taskId`
from the server response.

**Validates: Requirements 12.1, 12.2**

### Property 9: ConnectionType is forwarded to rsync mutations

*For any* `connectionType` value in `{ "remote", "ssh", "ec2" }`, calling
`rsyncPush` or `rsyncPull` must include that exact value in the `connectionType`
field of the GraphQL mutation variables.

**Validates: Requirements 12.3**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `exportYamlNodesToSnapshot` returns error | Throw with error message; no `onStepChange` called |
| Any `IdeGsmClient` mutation throws | Call `onStepChange(step, 'failed')`; re-throw unchanged |
| `awaitTask` throws (FAILED/CANCELED/WS close) | Call `onStepChange(step, 'failed')`; re-throw unchanged |
| Subsequent steps after failure | Not executed; no callbacks invoked |

Rules:
- Non-null assertion (`!`) is forbidden (AGENTS.md).
- No silent fallbacks or default-value coercion on error paths.
- All errors propagate to the caller unchanged.

---

## Testing Strategy

### Dual testing approach

Both unit tests and property-based tests are required and complementary.

- **Unit tests**: specific examples, integration points, edge cases (e.g. constructor stores client, no-op when `onStepChange` is omitted).
- **Property-based tests**: universal properties across randomly generated inputs (minimum 100 iterations per property).

### Property-based testing library

`fast-check` (already a dev dependency in sibling packages).

Each property test must be tagged with a comment in the format:

```
// Feature: simulation-workflow, Property N: <property text>
```

### Property test mapping

| Property | Test description |
|---|---|
| P1 | Mock all 4 client methods; record callback sequence; assert exact order |
| P2 | Mock rsyncPush/calibrate/simulate/rsyncPull; record callback sequence; assert exact order |
| P3 | For each step index, mock that step to throw; assert no subsequent callbacks |
| P4 | Mock any step to throw a specific Error; assert caller receives same error |
| P5 | Mock exportYamlNodesToSnapshot to return error; assert throw and zero callbacks |
| P6 | Generate arbitrary ExportFilter; assert exportProject receives identical value |
| P7 | Mock awaitTask for export to resolve with arbitrary paramsJson; assert return value equals it |
| P8 | Mock rsyncPush/rsyncPull server response with arbitrary taskId; assert return value equals it |
| P9 | Generate connectionType from valid set; assert mutation variables contain it |

### Unit test coverage

- Constructor stores `IdeGsmClient` without throwing.
- `runSimulation` without `onStepChange` executes all steps without error.
- `runSimulationWithRsync` without `onStepChange` executes all steps without error.
- `rsyncPush` / `rsyncPull` omit `include`/`exclude` from variables when filter is absent.

### Test configuration

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.ts'],
  },
});
```

Property tests use `fc.assert(fc.property(...), { numRuns: 100 })` as the
minimum iteration count.
