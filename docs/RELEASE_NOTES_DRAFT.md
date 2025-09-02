# Release Notes (Draft)

This draft summarizes changes for the upcoming runtime-worker release and related tooling.

Highlights
- CommandProcessor routing: create/update/move/remove/recover supported behind feature flags (default OFF)
- Trash holder flow: safer trash behavior (recover by holder decode), legacy-compatible fallback
- Undo/Redo expanded: update/move/remove/recover
- Error model unified: Core `CommandResult` / `ErrorCode` across worker
- Working Copy commit V2: integrated via CP behind flag, legacy Ephemeral discard retained
- Policy C: block move/remove when WC exists in subtree (with indexed search optimization)
- Headless tests: Node + fake-indexeddb integration scenarios for CP / WC / Policy C
- Trash migration tool: legacy <-> holder with metrics and rollback
- Lightweight command metrics: per-command counts/errors/latency with flag

Feature Flags (default OFF)
- `WORKER_USE_CMDPROC_CREATE_UPDATE` – Route create/update via CommandProcessor
- `WORKER_USE_CMDPROC_MOVE_REMOVE` – Route move/remove via CommandProcessor
- `WORKER_TRASH_USE_HOLDER` – Enable trash holder flow
- `WORKER_WC_COMMIT_V2` – Enable WC commit V2 via CP
- `WORKER_POLICY_C` – Enable Policy C (block move/remove when WC exists)
- `WORKER_METRICS_ENABLED` – Enable lightweight command metrics
- `WORKER_TX_ENABLED` – (Footing) Run commands under Dexie transaction helper

Compatibility & Rollback
- All new flows are gated with flags; switching OFF restores legacy behavior
- Error codes now align with Core; UI mapping can be updated incrementally
- WorkingCopyService.commit delegates to CP when V2 enabled; legacy path still works

Migration (Trash)
- Use `packages/runtime-worker/worker/src/tools/trash-migrate.ts`
  - Dry-run: `--dry-run --limit=100`
  - Commit: `--limit=1000 [--verbose] [--retries=2]`
  - Rollback: `--rollback --limit=1000`
- See `packages/runtime-worker/worker/docs/trash-migration-runbook.md` for details

Testing (Headless)
- Policy C and CP routing verified under Node + fake-indexeddb
- See `packages/runtime-worker/worker/src/e2e/__tests__/*.headless.test.ts`

Known Items / Next Steps
- Reference counting: port provided (registry injection), per-plugin implementation can follow
- Browser E2E: can be re-enabled later; headless coverage exists for critical flows
- Metrics export/visualization: future PR to expose snapshot externally or log periodically

