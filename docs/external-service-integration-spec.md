# External Service Integration Primitives

## Scope

HierarchiDB plugins may connect to external services such as IDE-GSM, catalog APIs, hosted processing runtimes, or future remote plugin backends. Features that are not tied to one service's protocol, domain objects, command names, or authorization model must live in service-neutral packages whose names do not include the service keyword.

Service-specific packages may provide adapters, labels, DTO mappings, and runtime providers, but they must not become the owner of reusable connection, health, transfer, or session-presentation contracts.

## Shared Packages

The current shared external-service primitives are:

- `@hierarchidb/ui-external-service-health`: canonical UI health state, checker port, and debounced health-check lifecycle.
- `@hierarchidb/ui-external-service-connection`: generic named-connection/manual-target step contract, validation, and presentation. Service packages may wrap it with service-named aliases for compatibility.
- `@hierarchidb/external-content-transfer`: immutable paged content-transfer helpers for external byte streams, including streaming CSV acquisition, digest verification, and sanitized cleanup telemetry.
- `@hierarchidb/build-api`, `@hierarchidb/ui-build-sessions`, and `@hierarchidb/ui-build-progress`: canonical Build Session runtime contract and shared session/progress presentation for external async work.

## Service-Specific Ownership

IDE-GSM-specific packages own only IDE-GSM protocol and domain responsibilities:

- GraphQL operation names and result DTOs such as `activeProjectTasks`, `beginProjectFileContentTransfer`, and FDM/project commands.
- server-side task status mapping where IDE-GSM status names are translated into canonical Build Session statuses.
- project path validation, IDE-GSM command IDs, project/FDM node relationships, and snapshot metadata tied to IDE-GSM project roots.
- app-level runtime providers that resolve endpoint URLs, CORS proxy settings, credentials, and named IDE-GSM connections.

`@hierarchidb/ui-ide-gsm-connection` is a compatibility wrapper around `@hierarchidb/ui-external-service-connection`. It must not reimplement the connection step, validation rules, or health lifecycle.

`plugins/idegsm-project-plugin` adapts IDE-GSM's project-file transfer operations to `@hierarchidb/external-content-transfer`, then commits the resulting table to IDE-GSM project snapshot metadata. It must not own generic CSV streaming, page validation, or digest verification logic.

## Extraction Rule

When adding an IDE-GSM feature, classify each new type and helper before implementation:

- If it mentions IDE-GSM command IDs, GraphQL field names, project-relative path semantics, FDM server objects, or IDE-GSM authorization behavior, it belongs in an IDE-GSM package.
- If it describes health state, named connection input, manual target resolution shape, debounced checking, immutable byte-stream transfer, content paging, generic CSV parsing, digest validation, or shared Build Session presentation, it belongs in a service-neutral package.
- If a feature is partly generic but still coupled to a single service because no second adapter exists, document the coupling and keep the public API narrow until another service confirms the abstraction.

The implementation must not hide contract violations through defaults, fallback branches, clamping, or lossy status mapping. Shared primitives surface stable errors and leave service adapters responsible for translating protocol-specific failures.

## Deferred Candidates

External async task/session projection is currently split between shared Build Session contracts/presentation and the IDE-GSM adapter that subscribes to IDE-GSM task events. The adapter still contains service-specific task IDs, command IDs, log epochs, and reconnection behavior. Extract a new service-neutral task-projection package only when another external backend needs the same lifecycle and can validate a common adapter boundary.
