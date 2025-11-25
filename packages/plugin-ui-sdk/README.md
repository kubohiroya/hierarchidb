# @hierarchidb/plugin-ui-sdk

## Purpose (Inner logic)
- Shared **inside-the-dialog** utilities: `useDialogDraft`, Basic Info normalization, common hooks/components used by dialog hosts.
- Field-level helpers and form logic that multiple plugin dialogs reuse.

## Boundaries
- Does **not** own the dialog shell or step navigation — those belong to `@hierarchidb/plugin-ui-host`.
- Keep presentation/icon lookup out of here; use `@hierarchidb/plugin-presentation` from host or app layer.

## When to use
- Implementing plugin dialogs and steps that need draft state wiring, basic info handling, or reusable form helpers.
- Sharing common UI logic across plugin dialog hosts without duplicating code.

## Avoid
- Shell/step-navigation concerns (keep them in `plugin-ui-host`).
- Plugin-specific one-off components that should live in the plugin package itself.
