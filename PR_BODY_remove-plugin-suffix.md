## Summary

Refactor nodeType naming to use short identifiers consistently (e.g., `folder`, `basemap`) and accept legacy `*-plugin` only at the boundary (UI routing). This simplifies internal logic and avoids scattered normalization.

## Changes

- runtime-ui/plugin-dialog: Canonicalize route param `:nodeType` once
  - Accept `folder-plugin` (legacy) and map to `folder` at route entry.
- ui/treeconsole/breadcrumb: Default `nodeType` to `folder`; keep legacy check for compatibility.
- node-type/basemap-plugin: Unify extension base to `folder` (not `folder-plugin`).
- TASKS.md: Move task to Doing, clarify boundary-only approach, add log.

Note: Several of these code changes already landed on `main` via prior commits; this PR formalizes the boundary-only policy and updates TASKS.md accordingly.

## Rationale

- Single Source of Truth for nodeType format (short identifiers only) reduces branching and surprises.
- Legacy acceptance is limited to input boundaries (URL), making removal straightforward later.

## DoD

- Short `nodeType` used internally across UI/Worker.
- UI route accepts legacy `*-plugin` and maps once.
- Local typechecks pass for affected packages.

## Rollback

- Revert the one-line normalization at the route boundary to disable legacy acceptance.

## Impact

- No runtime behavior change for users: legacy URLs continue to work; internals are cleaner.

