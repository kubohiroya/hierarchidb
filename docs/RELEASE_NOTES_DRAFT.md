# Release Notes (Draft)

This draft summarizes changes for the upcoming runtime-worker release and related tooling.

Highlights
- CommandProcessor routing: create/update/move/remove/recover are now always routed via CP (flags deprecated)
- Trash holder flow: safer trash behavior (recover by holder decode), legacy-compatible fallback
- Undo/Redo expanded: update/move/remove/recover
- Error model unified: Core `CommandResult` / `ErrorCode` across worker
- Working Copy commit V2: integrated via CP (legacy Ephemeral path removed)
- Policy C: block move/remove when WC exists in subtree (with indexed search optimization)
- Headless tests: Node + fake-indexeddb integration scenarios for CP / WC / Policy C
- Trash migration tool: legacy <-> holder with metrics and rollback
- Lightweight command metrics: per-command counts/errors/latency

Feature Flags
- Worker runtime no longer exposes rollout flags; all previous toggles are permanently enabled.
- Batch Control API V2 flag has been removed (API always available).
- Node-type plugin flags (`SHAPE_DOWNLOAD_STRATEGY`, `LOCATION_TABULAR`, `ROUTE_SEAROUTE`, `ROUTE_LANE_CAPS`, `ROUTE_TABULAR`) are now always on.

Compatibility & Rollback
- CommandProcessor routing for create/update/move/remove/recover is now unconditional (legacy flags removed)
- Error codes now align with Core; UI mapping can be updated incrementally
- WorkingCopyService.commit delegates to CP when V2 enabled; legacy path still works

Migration (Trash)
- Use `packages/runtime/worker-core/src/tools/trash-migrate.ts`
  - Dry-run: `--dry-run --limit=100`
  - Commit: `--limit=1000 [--verbose] [--retries=2]`
  - Rollback: `--rollback --limit=1000`
- See `packages/runtime/worker-core/docs/trash-migration-runbook.md` for details

Testing (Headless)
- Policy C and CP routing verified under Node + fake-indexeddb
- See `packages/runtime/worker-core/src/e2e/__tests__/*.headless.test.ts`

Known Items / Next Steps
- Reference counting: port provided (registry injection), per-plugin implementation can follow
- Browser E2E: can be re-enabled later; headless coverage exists for critical flows
- Metrics export/visualization: future PR to expose snapshot externally or log periodically
