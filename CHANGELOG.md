# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- breaking: DraftAPI renamed to TreeNodeUpdaterAPI, `getDraftAPI` removed
  - WorkerAPI now exposes only `getTreeNodeUpdaterAPI`; no compatibility shim.
  - Updated runtime-worker, plugin-ui-sdk, plugin-service-sdk, treeconsole, and E2E route spec to use updater API naming.
  - Typechecks run: common-api build, runtime-worker typecheck, plugin-ui-sdk typecheck, ui-treeconsole-base typecheck, plugin-service-sdk typecheck.

## 2025-09-04

- tools: vite-plugin-package-reader v0.1.0 — BREAKING: remove default export; use named exports only (e.g., `import { vitePluginPackageReader } from '@hierarchidb/tools-vite-plugin-package-reader'`). No internal usages relied on default export.

- runtime-worker: Deprecate `WORKER_USE_CMDPROC_CREATE_UPDATE` / `WORKER_USE_CMDPROC_MOVE_REMOVE` (now ignored)
- runtime-worker: Trash holder flow (flag `WORKER_TRASH_USE_HOLDER`) with legacy fallback and headless tests
- runtime-worker: Undo/Redo expanded to update/move/remove/recover
- runtime-worker: Error model unified to Core `CommandResult`/`ErrorCode`
- runtime-worker: Working Copy commit V2 integrated via CP (flag `WORKER_WC_COMMIT_V2`) with legacy fallback
- runtime-worker: Policy C (block move/remove when WC exists in subtree), with indexed search optimization and headless tests
- runtime-worker: Headless (Node + fake-indexeddb) integration tests for CP routing, Policy C, WC flows
- runtime-worker: Trash migration tool (legacy <-> holder) with metrics
- runtime-worker: Lightweight command metrics and docs（2025-09-19 時点で常時有効化）
- runtime-worker: DraftService commit now delegates to CP (V2) when enabled
- runtime-worker: NodeLifecycleManager reference counting port (registry injection) and headless unit test

## 2025-09-02

- runtime-worker: TreeMutationService now always routes create/update/move/remove/recover via CommandProcessor
- runtime-worker: Reliable create Undo/Redo (preserve created node id across undo/redo)
- docs/scripts: Mark `WORKER_USE_CMDPROC_CREATE_UPDATE` / `WORKER_USE_CMDPROC_MOVE_REMOVE` as deprecated and adjust examples
