# Design Document: ide-gsm-client

## Overview

`IdeGsmClient` is a TypeScript client library that wraps the IDE-GSM GraphQL API.
It provides a typed, Promise-based interface for triggering long-running tasks
(import, calibrate, simulate, export) via HTTP mutations and awaiting their
completion via WebSocket subscriptions.

The library is published as a new workspace package `@hierarchidb/ide-gsm-client`
under `packages/ide-gsm-client`, following the conventions established by
`packages/yaml-api` and `packages/yaml-store`.

### Goals

- Provide a minimal, dependency-light client for the IDE-GSM GraphQL API.
- Hide the HTTP/WebSocket plumbing behind a clean async/await interface.
- Enforce strict error handling — no silent fallbacks or null coercion.

### Non-Goals

- Retry logic or circuit-breaking (caller's responsibility).
- Caching of task results.
- Browser bundle optimisation (Node.js / Electron target only).

---

## Architecture

```
Caller
  │
  ▼
IdeGsmClient
  ├── HTTP mutations  ──► graphql-request ──► IDE-GSM :8080/graphql (HTTP)
  └── WS subscription ──► graphql-ws      ──► IDE-GSM :8080/graphql (WS)
```

`IdeGsmClient` is a single class that holds the endpoint URL and auth token.
Each mutation method creates a one-shot `GraphQLClient` (graphql-request) and
returns the `taskId` string from the response.
`awaitTask` opens a `graphql-ws` client, subscribes to `subscribeTaskOnFrontend`,
and resolves/rejects based on the received `TaskStatus`.

---

## Components and Interfaces

### Package layout

```
packages/ide-gsm-client/
  src/
    IdeGsmClient.ts        — main class
    ideGsmTypes.ts         — shared type definitions
    index.ts               — re-export entry point
  __tests__/
    IdeGsmClient.test.ts   — property-based tests (vitest + fast-check)
  package.json
  tsconfig.json
  tsconfig.typecheck.json
  vitest.config.ts
```

### `IdeGsmClient` (public API)

```ts
export class IdeGsmClient {
  constructor(endpointUrl: string, authToken: string)

  importProject(projectSnapshot: string, projectRelativePath: string): Promise<string>
  calibrate(projectRelativePath: string): Promise<string>
  simulate(projectRelativePath: string): Promise<string>
  exportProject(projectRelativePath: string, filter?: ExportFilter): Promise<string>
  awaitTask(taskId: string): Promise<TaskResult>
}
```

All methods are async and throw on any error condition (network, GraphQL, task
failure). No method swallows errors silently.

### Internal helpers

| Helper | Purpose |
|---|---|
| `deriveWsUrl(endpointUrl: string): string` | Converts `http(s)://…` → `ws(s)://…/graphql` |
| `buildAuthHeaders(authToken: string)` | Returns `{ Authorization: 'Bearer <token>' }` |

---

## Data Models

### `ideGsmTypes.ts`

```ts
export type TaskStatus = 'FINISHED' | 'FAILED' | 'CANCELED';

export interface TaskResult {
  id: string;
  status: TaskStatus;
  paramsJson: string;
}

export interface ExportFilter {
  include?: string[];
  exclude?: string[];
}
```

### GraphQL mutation shapes (sent over HTTP)

```graphql
mutation ImportProject($projectSnapshot: String!, $projectRelativePath: String!) {
  importProject(input: { projectSnapshot: $projectSnapshot, projectRelativePath: $projectRelativePath }) {
    taskId
  }
}

mutation Calibrate($projectRelativePath: String!) {
  calibrate(input: { projectRelativePath: $projectRelativePath }) {
    taskId
  }
}

mutation Simulate($projectRelativePath: String!) {
  simulate(input: { projectRelativePath: $projectRelativePath }) {
    taskId
  }
}

mutation ExportProject($projectRelativePath: String!, $include: [String!], $exclude: [String!]) {
  exportProject(input: { projectRelativePath: $projectRelativePath, include: $include, exclude: $exclude }) {
    taskId
  }
}
```

`include` and `exclude` variables are only added to the variables object when
present in the `ExportFilter`; absent fields are never sent as `null`.

### GraphQL subscription shape (sent over WebSocket)

```graphql
subscription SubscribeTaskOnFrontend($taskId: String!) {
  subscribeTaskOnFrontend(taskId: $taskId) {
    id
    status
    paramsJson
  }
}
```

### WebSocket URL derivation rule

| `endpointUrl` scheme | Derived WS URL |
|---|---|
| `http://host:port` | `ws://host:port/graphql` |
| `https://host:port` | `wss://host:port/graphql` |

The path `/graphql` is always appended to the base URL.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system
should do. Properties serve as the bridge between human-readable specifications
and machine-verifiable correctness guarantees.*

### Property 1: WebSocket URL scheme derivation

*For any* `endpointUrl` that begins with `http://`, the derived WebSocket URL
must begin with `ws://`. *For any* `endpointUrl` that begins with `https://`,
the derived WebSocket URL must begin with `wss://`.

**Validates: Requirements 1.4**

### Property 2: HTTP requests carry correct URL and auth header

*For any* `endpointUrl` and `authToken`, every HTTP mutation request sent by
`IdeGsmClient` must target a URL that starts with `endpointUrl` and must include
an `Authorization: Bearer <authToken>` header.

**Validates: Requirements 1.2, 1.3**

### Property 3: Mutation round-trip — returned taskId matches server response

*For any* mutation method (`importProject`, `calibrate`, `simulate`,
`exportProject`) and *for any* `taskId` string returned by the mocked server,
the value returned by the method must equal the `taskId` from the server
response.

**Validates: Requirements 2.2, 3.2, 4.2, 5.5**

### Property 4: HTTP and GraphQL errors always throw

*For any* mutation method and *for any* error response (network failure, non-2xx
HTTP status, or GraphQL `errors` array), the method must throw an `Error`. The
error message must include the `endpointUrl` for network failures and the HTTP
status code for non-2xx responses.

**Validates: Requirements 2.3, 3.3, 4.3, 5.6, 7.1, 7.2**

### Property 5: ExportFilter fields are included or omitted correctly

*For any* `ExportFilter` value, the mutation variables object sent to the server
must contain `include` if and only if `filter.include` is defined, and must
contain `exclude` if and only if `filter.exclude` is defined. When `filter` is
`undefined`, neither field appears in the variables.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 6: awaitTask round-trip identity

*For any* `taskId` string, when `awaitTask(taskId)` resolves successfully, the
`id` field of the returned `TaskResult` must equal the `taskId` argument.

**Validates: Requirements 6.2, 6.6**

### Property 7: FAILED or CANCELED status causes awaitTask to throw

*For any* `taskId` and *for any* terminal status of `FAILED` or `CANCELED`,
`awaitTask` must throw an `Error`. The error message must include both the
`taskId` and the status string.

**Validates: Requirements 6.3, 6.4**

### Property 8: Unexpected WebSocket close causes awaitTask to throw

*For any* `taskId`, if the WebSocket connection is closed before a terminal
`TaskStatus` event is received, `awaitTask` must throw an `Error` with a
descriptive message.

**Validates: Requirements 6.5, 7.3**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Network error (DNS, refused) | `graphql-request` throws; re-thrown with message containing `endpointUrl` |
| HTTP non-2xx | `graphql-request` throws `ClientError`; re-thrown with status code and body |
| GraphQL `errors` in response | `graphql-request` throws `ClientError`; re-thrown as-is |
| Task status `FAILED` | `awaitTask` throws `Error(\`Task \${taskId} failed with status FAILED\`)` |
| Task status `CANCELED` | `awaitTask` throws `Error(\`Task \${taskId} failed with status CANCELED\`)` |
| WebSocket close before terminal | `awaitTask` throws `Error(\`WebSocket closed before task \${taskId} completed\`)` |

Rules:
- Non-null assertion (`!`) is forbidden (AGENTS.md).
- No silent fallbacks or default-value coercion on error paths.
- All errors propagate to the caller unchanged or wrapped with additional context.

---

## Testing Strategy

### Dual testing approach

Both unit tests and property-based tests are required and complementary.

- **Unit tests** cover specific examples, integration points, and edge cases.
- **Property-based tests** verify universal properties across randomly generated
  inputs (minimum 100 iterations per property).

### Property-based testing library

`fast-check` (already a dev dependency in sibling packages).

Each property test must be tagged with a comment in the format:

```
// Feature: ide-gsm-client, Property N: <property text>
```

### Property test mapping

| Property | Test description |
|---|---|
| P1 | Generate arbitrary `http://` and `https://` URLs; assert derived WS scheme |
| P2 | Mock `graphql-request`; generate arbitrary URL + token; assert request URL and header |
| P3 | Mock server response with arbitrary `taskId`; assert return value equals it |
| P4 | Mock various error responses; assert every mutation throws |
| P5 | Generate arbitrary `ExportFilter` combinations; assert variables object shape |
| P6 | Mock WS with FINISHED event carrying arbitrary `taskId`; assert `result.id` equals input |
| P7 | Mock WS with FAILED/CANCELED events; assert throw with taskId and status in message |
| P8 | Mock WS close event; assert throw |

### Unit test coverage

- Constructor stores `endpointUrl` and `authToken` without throwing.
- `deriveWsUrl` handles edge cases: trailing slash, path already present.
- `exportProject` with no filter omits `include`/`exclude` from variables.
- `awaitTask` closes the WebSocket client after resolving or rejecting.

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
