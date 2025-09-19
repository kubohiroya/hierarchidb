Title: Type hygiene + tests for TreeConsole and plugins; workspace typecheck green

Summary
- App: fixed Node16 imports, ambient shims, and TrashDialog display mode state; typecheck passes.
- TreeConsole UI: verified typecheck across base/breadcrumb/toolbar/trashbin/treetable; added edge-case unit tests for coalesceBatches; configured vitest.
- Plugins: patched timeline (react-transition-group type bridge), route/linker (dialog registry + WorkerAPI types), spreadsheet (Dexie v4 subclass typing + config step shims).
- Workspace: all packages typecheck successfully.

Tests
- @hierarchidb/ui-treeconsole-treetable: descendants/canDropNode tests.
- @hierarchidb/ui-treeconsole-base: new mergeUtils edge cases test covering remove-after-update, multiple moves/updates, add-then-remove.

Follow-ups
- Remove temporary .d.ts shims after upstream packages publish richer types (runtime-ui-plugin-dialog, timeline-plugin).
- Expand DnD constraint tests (self-drop, descendant-drop) when orchestrator is fully wired.

