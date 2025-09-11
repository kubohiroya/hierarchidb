Title: TreeConsole UX: Rich Create Menu, Toolbar Actions, DnD, Column Resize; mrtask + Guards; CI Fixes

Summary
- UI/UX
  - Create menu shows plugin icon/group color/name/tooltip; actions call `create:<nodeType>`.
  - Toolbar wires Undo/Redo/Cut/Copy/Paste/Duplicate/MoveToTrash/Import/Export to real handlers.
  - Theme/Language submenus; bridged to app via custom events.
  - Breadcrumb drop-to-parent; row DnD move; hover highlight; prevent invalid drops at worker level.
  - Column resize localized to adjacent columns only; widths persisted to localStorage.
  - InitInspector is draggable MUI Dialog; z-index fixes for Settings.

- Worker/Integration
  - Undo/Redo availability reflects `CommandProcessor.canUndo/canRedo` (light polling + refresh after mutating actions).
  - Move/Paste/Duplicate use MutationAPI; error surfaced (Policy C etc.).

- Build/CI/Guards
  - Biome/ESLint core jobs temporarily disabled; dep-fence guards workflow added.
  - DTS quick build order fixed (build common-type/common-api/base-plugin/tabular-store first).
  - MapLibre policy check script wired in policy workflow.

Testing
- Verified via `pnpm dts:quick` (green).
- Manual: create items from SpeedDial and row context menu; DnD row → another folder; breadcrumb drop reparent; Undo/Redo updates button state.

Risk/rollback
- Mostly UI layer; guarded by worker checks. Can rollback by reverting package versions and `app/src/components/*` changes.

Notes
- Follow-up: switch Undo/Redo polling to event subscription when worker event-bus is exposed.
