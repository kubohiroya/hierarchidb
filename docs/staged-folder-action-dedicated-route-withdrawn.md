# Dedicated Browser Export Route

## Status

This specification is withdrawn.

The previous design introduced a dedicated `/map-export` internal route and a browser API such as `window.__HDB_MAP_EXPORT__`. That direction is no longer the canonical design because it creates a special execution path separate from the existing TreeConsole, folder build queue, AppBar session manager, and Map UI.

## Replaced By

Use the staging / overlay / session-manager design instead:

- `docs/staged-folder-action-runner-execution-model.md`
- `docs/staged-folder-action-manifest-format.md`
- `docs/staged-folder-action-spec.md`

## Current Contract

Staged folder action runner must use the existing application surfaces:

- TreeConsole-visible staging folder/node
- existing recursive copy/import or equivalent tree copy
- copy-on-write `copyOnWriteOf` / `patchData` overlay and effective data resolution
- existing folder build target collection
- existing `BuildJobQueue` / canonical build session
- AppBar session manager for build progress
- existing Map UI for `map-image-capture` action
- CLI-selected `--browser headless|headed` execution of the existing Map UI in a new tab

Do not implement a dedicated route as the normal staged folder action execution path.

## Historical Notes

The withdrawn route design had useful requirements that remain valid:

- build completion alone is not render readiness.
- capture must wait for MapLibre idle and nonblank canvas.
- page error, unhandled rejection, and WebGL context loss must fail the run.
- requested layers must not be silently omitted.

These requirements now apply to `map-image-capture` through the existing Map UI.

## Rollback

No runtime rollback is required for this documentation change. The legacy dedicated route implementation has been removed; new staged folder action work must not build on it or reintroduce it.

Implementation note:

- The application router must not register `/map-export` as a top-level route. Legacy route/page files must not remain in the application source tree, and the staged-folder-action browser handoff path must use the normal Map UI route.
