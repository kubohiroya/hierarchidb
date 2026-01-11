# Heap Pressure Monitoring and Build Pause Notifications

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, the app can automatically pause builds when JavaScript heap memory pressure is detected in either the UI thread or the Worker, and it can explain the pause via a consistent warning dialog. Users can see the warning in the build step UI and can resume after lowering concurrency. This makes long-running builds safer and more predictable under memory pressure.

## Progress

- [x] (2025-12-26 00:25 JST) Baseline: collect context, align on API shape, and create new packages `packages/memory` and `packages/ui/memory`.
- [x] (2025-12-26 00:25 JST) Implement heap pressure Pub/Sub monitor in `packages/memory` with UI + Worker compatibility.
- [x] (2025-12-26 00:25 JST) Implement UI dialog + hooks in `packages/ui/memory` and wire to build steps.
- [x] (2025-12-26 00:25 JST) Add WorkerAPI subscription for heap pressure and connect Worker runtime monitor.
- [x] (2025-12-26 00:25 JST) Integrate OR-logic (UI + Worker) pause/alert in shape/location/route build UIs.
- [ ] (2025-12-26 00:25 JST) Validate with `pnpm --filter @hierarchidb/shape-plugin typecheck` and manual UI checks.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Use OR semantics across UI and Worker heap pressure events. Any pressure event pauses the build and shows the dialog.
  Rationale: Prioritize safety and minimize crashes under memory pressure with the simplest rule.
  Date/Author: 2025-12-26 / Codex.
- Decision: UI heap pressure detection lives in each build step (shape/location/route) rather than TreeConsole.
  Rationale: Build steps own the pause action and dialog, and should be the source of build-control side effects.
  Date/Author: 2025-12-26 / Codex.
- Decision: Expose Worker heap pressure notifications through WorkerAPI `subscribeHeapPressure(...)` and WorkerBridge to keep UI integration uniform.
  Rationale: Existing build progress already uses subscription-style WorkerAPI methods; this aligns with current patterns.
  Date/Author: 2025-12-26 / Codex.

## Outcomes & Retrospective

- Implemented heap pressure monitoring packages and wired build steps to auto-pause with warning dialogs; validation still pending.

## Context and Orientation

The Worker runtime entry point is `app/src/worker-runtime/worker.ts`, which exposes a Comlink API using `WorkerAPI` from `packages/common/api/src/WorkerAPI.ts`. UI code typically accesses Worker APIs via `packages/ui/worker-client/src/workerBridge.ts` (WorkerBridge), which wraps WorkerAPI methods and provides subscription helpers for progress events.

Shape build UI is in `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` and uses `useShapeBuildStep` for controlling pause/resume. Location build UI is `plugins/location-plugin/src/ui/components/steps/LocationBuildStep.tsx` (pause/resume via WorkerBridge). Route build UI is `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` (currently local state only).

There is an existing UI memory chart package `packages/ui/memory-usage` with a `useMemoryData` hook for visualization. This plan does not reuse it directly; the new packages focus on heap-pressure alerts and Pub/Sub.

The app already stores build-related monitoring in `plugins/shape-plugin/src/ui/utils/buildMonitor.ts`, but this is local-only and should be superseded by the new packages for ongoing pressure detection during builds.

## Plan of Work

First, create `packages/memory` as a new workspace package. It will export a heap pressure monitor with a Pub/Sub API. The monitor is environment-agnostic and uses `performance.memory` when available. It should expose:

1) A `HeapPressureEvent` type that includes the event source (`'ui'` or `'worker'`), timestamp, ratio, usedBytes, limitBytes, and optional build context (nodeType, sessionId).
2) A `HeapPressureMonitor` class or factory with `start()`, `stop()`, `subscribe(listener)`, `getSnapshot()`, and `setContext()` methods.
3) Default thresholds (warning 0.85, critical 0.9) and sampling interval (10s) consistent with current shape monitoring, but configurable via options.

Second, create `packages/ui/memory` as a UI package with:

1) A `HeapPressureDialog` component (MUI Dialog) that renders a warning message and an OK/Close action.
2) A `useHeapPressureGuard` hook that merges UI + Worker events into a single “should pause” signal and returns the latest event plus a `dismiss` callback.
3) A `useHeapPressureMonitor` hook that starts the UI-side monitor from `@hierarchidb/memory`.

Third, add Worker heap pressure monitoring:

1) Extend `packages/common/api/src/WorkerAPI.ts` with `subscribeHeapPressure(callback)` returning an unsubscribe function.
2) Update `packages/ui/worker-client/src/workerBridge.ts` to expose `subscribeHeapPressure`.
3) In `app/src/worker-runtime/worker.ts`, create a Worker-side `HeapPressureMonitor`, start it when the worker boots, and expose a `subscribeHeapPressure` API that proxies events to UI. When a batch session is started, call `setContext({ nodeType, sessionId })` so events include build context.

Fourth, integrate build steps:

1) Shape build step (`plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`) should remove ad hoc heap dialog logic and replace it with `useHeapPressureGuard` + `HeapPressureDialog`. When a heap event is received and build is running, call `handlePause()` once per session and open the dialog.
2) Location build step (`plugins/location-plugin/src/ui/components/steps/LocationBuildStep.tsx`) should use `useHeapPressureGuard` and call `handlePause()` + show the dialog.
3) Route build step (`plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`) should use the same hook. Because route build is currently local-state, the guard can set status to `paused` and show the dialog (no Worker call).

Fifth, update dependencies:

1) Add `@hierarchidb/memory` and `@hierarchidb/ui-memory` to the relevant plugin package.json files and app UI packages that will import them.
2) Ensure tsdown build scripts exist for both new packages and add them to the workspace with `typecheck` scripts.

Finally, remove or disable the current local-only heap warning logic in `plugins/shape-plugin/src/ui/utils/buildMonitor.ts` and `useHeapPressure` (if kept, mark as legacy). The new monitor should be the source of runtime pressure warnings.

## Concrete Steps

Work from repo root.

1) Create package scaffolds.
   - Create `packages/memory/package.json`, `packages/memory/tsconfig.json`, `packages/memory/src/index.ts`.
   - Create `packages/ui/memory/package.json`, `packages/ui/memory/tsconfig.json`, `packages/ui/memory/src/index.ts`, and UI components/hooks.

2) Implement `@hierarchidb/memory`.
   - Add types: `HeapPressureEvent`, `HeapPressureLevel`, `HeapPressureContext`.
   - Implement `createHeapPressureMonitor(options)` returning an object with `start()`, `stop()`, `subscribe()`, `setContext()`, `getSnapshot()`.
   - Use `performance.memory` if present; otherwise no-op and keep `isSupported=false`.

3) Extend WorkerAPI and WorkerBridge.
   - Update `packages/common/api/src/WorkerAPI.ts` to add `subscribeHeapPressure`.
   - Update `packages/ui/worker-client/src/workerBridge.ts` with a new `subscribeHeapPressure` method using Comlink proxy.
   - Update `app/src/worker-runtime/worker.ts` to create a monitor, start it, and expose `subscribeHeapPressure`.

4) Implement `@hierarchidb/ui-memory`.
   - Add `HeapPressureDialog` and `useHeapPressureGuard`.
   - `useHeapPressureGuard` should start UI monitor, subscribe to worker events, merge events (OR), and expose `shouldPause` + `latestEvent`.

5) Integrate into build steps.
   - Shape: replace ad hoc dialog/logic with `useHeapPressureGuard`.
   - Location: wire pause + dialog using `useHeapPressureGuard`.
   - Route: wire pause + dialog using `useHeapPressureGuard`.

6) Update dependencies in `package.json` for plugins and app UI packages.

Example commands (run from repo root):

  - pnpm --filter @hierarchidb/shape-plugin typecheck
  - pnpm --filter @hierarchidb/location-plugin typecheck
  - pnpm --filter @hierarchidb/route-plugin typecheck

Expected success transcript:

  - @hierarchidb/shape-plugin typecheck ... exit 0
  - @hierarchidb/location-plugin typecheck ... exit 0
  - @hierarchidb/route-plugin typecheck ... exit 0

## Validation and Acceptance

Manual validation:

1) Start the app with `pnpm dev`.
2) Open a shape build dialog and start a build.
3) Simulate heap pressure by lowering browser memory or by using a dev-only toggle (if available). When pressure is detected:
   - The build should pause automatically.
   - The heap pressure dialog should appear.
4) Repeat for location build. For route, use the build step UI and verify the dialog and paused status.

Acceptance criteria:

1) Worker heap pressure events are emitted and can be subscribed via `WorkerAPI`.
2) UI heap pressure events are detected and merged with Worker events using OR semantics.
3) Build steps pause on heap pressure and show the warning dialog.
4) Non-supporting browsers do not throw errors and simply skip monitoring.

## Idempotence and Recovery

All changes are additive or replace existing UI-only warnings. Re-running builds or starting/stopping monitors is safe. If heap-pressure monitoring causes false positives, rollback by removing the new packages and reverting the WorkerAPI additions. This returns the system to current behavior without impacting build sessions.

## Artifacts and Notes

Expected heap pressure event object (example):

  { source: "worker", level: "warning", ratio: 0.88, usedBytes: 720000000, limitBytes: 820000000, context: { nodeType: "shape", sessionId: "..." }, timestamp: 1760000000000 }

Expected UI log (optional):

  [HeapPressure] pause build: source=worker level=warning ratio=0.88 sessionId=...

## Interfaces and Dependencies

`packages/memory` should export:

  - type HeapPressureLevel = 'warning' | 'critical'
  - type HeapPressureContext = { nodeType?: string; sessionId?: string }
  - type HeapPressureEvent = { source: 'ui' | 'worker'; level: HeapPressureLevel; ratio: number; usedBytes: number; limitBytes: number; timestamp: number; context?: HeapPressureContext }
  - type HeapPressureMonitor = { start(): void; stop(): void; subscribe(cb): () => void; setContext(ctx: HeapPressureContext | null): void; getSnapshot(): HeapPressureEvent | null }
  - function createHeapPressureMonitor(options?): HeapPressureMonitor

`packages/ui/memory` should export:

  - `HeapPressureDialog` React component
  - `useHeapPressureGuard(options)` hook returning `{ event, shouldPause, dismiss }`
  - `useHeapPressureMonitor(options)` hook returning `{ event, isSupported }`

`WorkerAPI` additions:

  - `subscribeHeapPressure(callback: (event: HeapPressureEvent) => void): Promise<() => void>`

Note: all code comments and docs must be in English. Keep user-visible UI text localized via existing `t()` calls.

---
Change Log: Initial plan created for memory Pub/Sub and UI/Worker heap-pressure integration (2025-12-26).
