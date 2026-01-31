# Folder Draft Policy

Status: Draft • Last updated: 2025-09-11

This document summarizes how “Draft” applies to folder nodes and how UI/worker enforce it.

- Single Draft per target: a subtree may contain at most one active Draft for a given target entity. See `adr-single-draft-per-target`.
- Holder-based Trash: deletion and recover operations flow through “trash holders” under the per-tree trash root. See `adr-draft-trash-unification`.
- Policy C (move/delete guard): moving or deleting a node is blocked if any descendant has an active Draft. Enforcement lives in the Worker `CommandProcessor` (Policy C), so UI does not duplicate the check.

Implications for UI (TreeConsole):

- Drag & Drop reparenting uses `MutationAPI.moveNodes`. If Policy C would block the operation, the worker returns `{ success: false, code: INVALID_OPERATION }` and the UI surfaces a non-destructive error toast.
- Move to Trash and Remove commands also rely on worker-side checks; UI doesn’t guess. We only optimistically disable actions when selection is empty.
- Undo/Redo reflects worker history. The toolbar enables buttons based on `CommandProcessor.canUndo()`/`canRedo()` read via a light polling loop.
- Table-state persistence (e.g., column widths) is stored per page (node). These entries are removed only on permanent deletion from Trash (empty-all or single permanent delete), not on move-to-trash.

Developer notes:

- Do not reimplement Policy C in the UI. Tests belong to worker/service level.
- For future: subscribe to a command-event bus to remove polling for undo/redo.

References:

- `packages/runtime/worker/src/services/CommandProcessor.ts`
- `packages/runtime/worker/docs/adr/adr-draft-trash-unification.md`
- `packages/runtime/worker/docs/adr/adr-block-move-delete-when-wc-in-subtree.md`
