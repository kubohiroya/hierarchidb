# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- runtime-worker: CommandProcessor routing extended (create/update/move/remove/recover) behind feature flags (default OFF)
- runtime-worker: Trash holder flow (flag `WORKER_TRASH_USE_HOLDER`) with legacy fallback and headless tests
- runtime-worker: Undo/Redo expanded to update/move/remove/recover
- runtime-worker: Error model unified to Core `CommandResult`/`ErrorCode`
- runtime-worker: Working Copy commit V2 integrated via CP (flag `WORKER_WC_COMMIT_V2`) with legacy fallback
- runtime-worker: Policy C (block move/remove when WC exists in subtree), with indexed search optimization and headless tests
- runtime-worker: Headless (Node + fake-indexeddb) integration tests for CP routing, Policy C, WC flows
- runtime-worker: Trash migration tool (legacy <-> holder) with metrics
- runtime-worker: Lightweight command metrics (flag `WORKER_METRICS_ENABLED`) and docs
- runtime-worker: WorkingCopyService commit now delegates to CP (V2) when enabled
- runtime-worker: NodeLifecycleManager reference counting port (registry injection) and headless unit test

