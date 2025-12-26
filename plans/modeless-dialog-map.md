# Introduce modeless map dialogs with shared dialog base

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` in the repository root and must be maintained accordingly.

## Purpose / Big Picture

The map page should be able to show multiple non-modal dialog windows on top of the map, each movable, resizable, and stackable, with consistent header UI and the ability to minimize, maximize, or full-screen. This work makes it possible to keep map context visible while working with several tool windows at once, and the user can verify the result by opening `/hierarchidb/map` and interacting with multiple windows in parallel.

## Progress

- [x] 2025-12-26 16:43 Captured requirements and staged the task in `TASKS.md` with DoD, rollback, and a start log entry.
- [x] 2025-12-26 17:04 Define the shared dialog base (`AbstractDialog`) and update existing `HeadlessPluginDialog` to delegate to it without behavior changes.
- [x] 2025-12-26 17:04 Introduce a modeless dialog frame component with drag/resize and minimized handling, and export it from `@hierarchidb/ui-dialog`.
- [x] 2025-12-26 17:04 Extend dialog context to expose minimize state + handler and add the minimize control to the header UI (only when enabled).
- [x] 2025-12-26 17:04 Implement a map window manager that persists window state + stacking order to localStorage and renders multiple modeless dialogs on `/map/$nodeId`.
- [ ] 2025-12-26 18:30 Validate map behavior manually (multiple windows, z-order rotation, drag/resize, minimize/maximize/full-screen, icon restore) and record results in `TASKS.md`.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Use a lightweight modeless frame component rather than the existing floating-window package.
  Rationale: Requirement explicitly asks for a shared base with `PluginDialog` and identical header UI, which is provided by `@hierarchidb/ui-dialog` + `@hierarchidb/plugin-ui-host` rather than `@hierarchidb/ui-floating-window`.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

- Pending. This section will be filled once the implementation is complete.

## Context and Orientation

`packages/ui/dialog` contains the headless dialog primitives used throughout the UI. The current `HeadlessPluginDialog` provides context for header/content/footer components, while `PluginDialogFrame` renders a modal with drag/resize and a backdrop. The plugin UI header is implemented in `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx` and relies on the dialog context for display mode and window controls. The map route is `app/src/router/routes/map.tsx`. The modeless window manager lives in `app/src/router/routes/mapDialogWindows.tsx` with layout helpers in `app/src/router/routes/mapDialogLayout.ts` and content blocks in `app/src/router/routes/mapDialogContent.tsx`.

The goal is to introduce an `AbstractDialog` base for `HeadlessPluginDialog` and a new `ModelessDialogFrame` for non-modal windows. Then build a small window manager on the map page that renders multiple modeless dialogs, tracks z-order, and persists position/size/display mode/minimize state to localStorage.

## Plan of Work

First, extract the body of `HeadlessPluginDialog` into a new `AbstractDialog` component in `packages/ui/dialog/src/headless/AbstractDialog.tsx`. Update `HeadlessPluginDialog` to become a thin wrapper that calls `AbstractDialog` so that existing behavior remains unchanged. Ensure the new base is exported from `packages/ui/dialog/src/index.ts`.

Next, add a `ModelessDialogFrame` component in `packages/ui/dialog/src/headless/ModelessDialogFrame.tsx`. It should mirror the drag/resize logic of `PluginDialogFrame` but omit the modal backdrop, do not lock `document.body` overflow, and accept a `zIndex` plus `onRequestFocus` so the map can manage stacking. When `headlessProps.isMinimized` is true, collapse the frame height to a small header bar while preserving the stored size for restore. Export this component from `packages/ui/dialog/src/index.ts`.

Then, extend dialog frame props in `packages/ui/dialog/src/headless/types.ts` to include optional `isMinimized` and `onMinimizeChange`. Update `HeadlessPluginDialog`/`AbstractDialog` to pass these through the context. Add a minimize button to `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`, implemented in `PluginDialogControls.tsx`, and only render it when `ctx.onMinimizeChange` is provided. Update `packages/ui/i18n/public/locales/en/common.json` and `packages/ui/i18n/public/locales/ja/common.json` with tooltip/label strings for minimize and restore.

Finally, introduce a `ModelessDialogManager` that owns window visibility, z-order rotation, and localStorage persistence. It should also render draggable icon buttons for closed dialogs and restore the original position/size/display mode when the icon is clicked. This manager should be used by the map page to coordinate multiple modeless dialogs.

Finally, implement a map window manager in `app/src/router/routes/mapDialogWindows.tsx` with layout helpers in `app/src/router/routes/mapDialogLayout.ts`. Define a window state model containing id, size, position, display mode, minimized flag, visibility, and a per-window restore cache for normal size/position. Load and persist this state to localStorage using a per-node key (include `$nodeId` so each folder has its own layout). Render at least two modeless dialogs (e.g., "Map Info" and "Layers") using `ModelessDialogFrame` and a one-step headless dialog configuration with the existing plugin dialog header component. Clicking a dialog should bring it to front by updating the order array; z-index is computed from this order and a base value below MUI modal z-index. Extract the content blocks into `app/src/router/routes/mapDialogContent.tsx` to keep UI code compact.

## Concrete Steps

1) Create `packages/ui/dialog/src/headless/AbstractDialog.tsx` by moving the body of `HeadlessPluginDialog` into it. Update `HeadlessPluginDialog` to return `<AbstractDialog {...props} />`. Update exports in `packages/ui/dialog/src/index.ts`.
   - Working directory: repo root.
   - Expected diff: new file, `PluginDialog.tsx` simplified, index export added.

2) Implement `packages/ui/dialog/src/headless/ModelessDialogFrame.tsx` with drag/resize, `zIndex`, optional portal support, and minimized height behavior. Export it from `packages/ui/dialog/src/index.ts`.
   - Working directory: repo root.
   - Expected diff: new file + export.

3) Add `isMinimized?: boolean` and `onMinimizeChange?: (next: boolean) => void` to `DialogFrameProps` and `HeadlessDialogContextValue` in `packages/ui/dialog/src/headless/types.ts`. Ensure `AbstractDialog`/`HeadlessPluginDialog` spread these into context.

4) Add a minimize button in `packages/plugin-ui-host/src/headless/components/PluginDialogControls.tsx` and render it in `PluginDialogHeader.tsx` when `ctx.onMinimizeChange` is available. Update i18n strings in `packages/ui/i18n/public/locales/en/common.json` and `packages/ui/i18n/public/locales/ja/common.json`.

5) Update `app/src/router/routes/map.tsx` to render `ModelessDialogManager` and implement the window manager in `app/src/router/routes/modeless/ModelessDialogManager.tsx` (or equivalent module), with layout helpers and content blocks. Use `ModelessDialogFrame` and `PluginDialogHeader` to keep header styling consistent. Implement z-order management, icon button restore UI, and localStorage persistence keyed by node id.

## Validation and Acceptance

- Manual validation: run the app, navigate to `/hierarchidb/map/<nodeId>`, confirm at least two modeless windows are present and can be dragged, resized, minimized, maximized, and full-screened. Click different windows to confirm z-order changes (active window is on top). Reload the page and confirm window positions/sizes/minimized state restore from localStorage.
- Regression check: open any standard modal PluginDialog (e.g., create folder) and confirm the header layout/controls and modal behavior remain unchanged.
- Record the verification steps and outcome in `TASKS.md` worklog #18.

## Idempotence and Recovery

The window manager state is stored in localStorage and can be cleared by removing the map window storage key. Code changes can be reverted by removing `AbstractDialog`, `ModelessDialogFrame`, and related header changes; reverting these files returns the system to the previous modal-only behavior.

## Artifacts and Notes

- Expected localStorage key format: `hdb.map.dialogs.<nodeId>`
- Base z-index: use a value below `theme.zIndex.modal` to keep modal dialogs above modeless windows.

## Interfaces and Dependencies

- `packages/ui/dialog/src/headless/AbstractDialog.tsx`: new base dialog component.
- `packages/ui/dialog/src/headless/ModelessDialogFrame.tsx`: new modeless frame.
- `packages/ui/dialog/src/headless/types.ts`: add `isMinimized` + `onMinimizeChange` to `DialogFrameProps` and `HeadlessDialogContextValue`.
- `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx` and `PluginDialogControls.tsx`: add minimize control.
- `app/src/router/routes/map.tsx`: render `MapDialogWindows` on the map page.
- `app/src/router/routes/modeless/ModelessDialogManager.tsx`: manager + view composition.
- `app/src/router/routes/modeless/modelessDialogLayout.ts`: localStorage layout helpers.
- `app/src/router/routes/modeless/modelessDialogContent.tsx`: map dialog content components.

Plan update note (2025-12-26): Updated Progress and plan to include ModelessDialogManager responsibilities and icon restore UI, and revised file references for the new manager module.
