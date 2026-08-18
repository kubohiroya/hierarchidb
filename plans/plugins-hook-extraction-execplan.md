# Extract Plugin TSX Logic Into Custom Hooks

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

Plugins under `plugins/` contain TSX components that mix rendering (JSX) with stateful orchestration, effect wiring, data normalization, and event handlers. The goal is to make those components easier to read and maintain by extracting non-view logic into dedicated custom hooks located next to the component files. After this change, each targeted component delegates its state and handlers to a `use*` hook while preserving the rendered UI and behavior. Success is visible by inspecting the component/hook pairing and by running the relevant plugin typechecks without errors.

## Progress

- [x] (2026-02-01 18:55 JST) Created ExecPlan for plugin TSX hook extraction.
- [x] (2026-02-01 19:00 JST) Inventoried `plugins/**/*.tsx` and identified high-logic candidates.
- [x] (2026-02-01 19:15 JST) Extracted hooks for basemap-plugin (BaseMapDisplay, ViewportStep) and kept rendering unchanged.
- [x] (2026-02-01 19:16 JST) Ran `pnpm --filter @hierarchidb/basemap-plugin typecheck` (exit 0).
- [x] (2026-02-01 19:30 JST) Extracted hooks for styler-plugin (StylerAlgorithmStep2) and kept rendering unchanged.
- [x] (2026-02-01 19:31 JST) Ran `pnpm --filter @hierarchidb/styler-plugin typecheck` (exit 0).
- [x] (2026-02-01 19:50 JST) Extracted hook for shape-plugin BuildProgress atom sync (ShapeBuildStep).
- [x] (2026-02-01 19:51 JST) Ran `pnpm --filter @hierarchidb/shape-plugin typecheck` (exit 0).
- [x] (2026-02-01 20:05 JST) Extracted hook for location-plugin (LocationSelectionStep).
- [x] (2026-02-01 20:10 JST) Ran `pnpm --filter @hierarchidb/location-plugin typecheck` (exit 0).
- [x] (2026-02-01 20:25 JST) Extracted hook for route-plugin (RouteDataSourceStep).
- [x] (2026-02-01 20:26 JST) Ran `pnpm --filter @hierarchidb/route-plugin typecheck` (exit 0).
- [x] (2026-02-01 20:45 JST) Extracted hook for shape-plugin (ShapeBuildProgressPanel).
- [x] (2026-02-01 20:46 JST) Ran `pnpm --filter @hierarchidb/shape-plugin typecheck` (exit 0).
- [x] (2026-02-01 21:05 JST) Extracted hook for location-plugin (LocationStyleConfigPanel).
- [x] (2026-02-01 21:11 JST) Ran `pnpm --filter @hierarchidb/location-plugin typecheck` (exit 0).
- [x] (2026-02-01 21:25 JST) Extracted hook for route-plugin (RouteBatchLaunchForm).
- [x] (2026-02-01 21:26 JST) Ran `pnpm --filter @hierarchidb/route-plugin typecheck` (exit 0).
- [x] (2026-02-01 22:20 JST) Extracted hook for location-plugin (LocationDataSourceStep).
- [x] (2026-02-01 22:21 JST) Ran `pnpm --filter @hierarchidb/location-plugin typecheck` (exit 0).
- [x] (2026-02-01 22:50 JST) Extracted hook for location-plugin (LocationMapPreviewStep).
- [x] (2026-02-01 22:54 JST) Ran `pnpm --filter @hierarchidb/location-plugin typecheck` (exit 0).
- [x] (2026-02-01 23:20 JST) Extracted hook for route-plugin (RouteSelectionStep).
- [x] (2026-02-01 23:21 JST) Ran `pnpm --filter @hierarchidb/route-plugin typecheck` (exit 0).
- [x] (2026-02-01 23:45 JST) Extracted hook for shape-plugin (TransformConfigSection).
- [x] (2026-02-01 23:47 JST) Ran `pnpm --filter @hierarchidb/shape-plugin typecheck` (exit 0).
- [x] (2026-02-02 00:17 JST) Extracted hook for route-plugin (RoutePreviewStep).
- [x] (2026-02-02 00:20 JST) Ran `pnpm --filter @hierarchidb/route-plugin typecheck` (exit 0).
- [x] (2026-02-02 00:33 JST) Extracted hook for spreadsheet-plugin (TabularDataFilterStep).
- [x] (2026-02-02 00:34 JST) Ran `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck` (exit 0).
- [x] (2026-02-02 00:52 JST) Ran `pnpm --filter @hierarchidb/route-plugin typecheck` after RoutePreviewStep cleanup (exit 0).
- [x] (2026-02-02 00:57 JST) Extracted hook for resolver-plugin (ValidationConfigStep).
- [x] (2026-02-02 00:58 JST) Ran `pnpm --filter @hierarchidb/resolver-plugin typecheck` (exit 0).
- [ ] Extract logic into hooks for remaining target components.
- [ ] Run typecheck for remaining affected plugins and record results.
- [ ] Update the linked GitHub Issue with progress and completion notes.

## Surprises & Discoveries

- Observation: Hook extraction for StylerAlgorithmStep2 required narrowing hook params to a Pick of PluginStepProps to avoid missing `mode`/`disabled` fields.
  Evidence: `pnpm --filter @hierarchidb/styler-plugin typecheck` initially failed with TS2345 until the hook param type was narrowed.

- Observation: LocationSelectionStep needed explicit type-only imports after moving buildSelectionRecord to the component.
  Evidence: `pnpm --filter @hierarchidb/location-plugin typecheck` failed with TS2304/TS2552 until MatrixSelection/LocationType imports were added.

- Observation: LocationStyleConfigPanel needed cleanup of unused constants/types after moving default config logic into the hook.
  Evidence: `pnpm --filter @hierarchidb/location-plugin typecheck` failed with TS6196/TS6133 until the unused definitions were removed.

- Observation: LocationMapPreviewStep hook file needed a `.tsx` extension because it contains JSX.
  Evidence: `pnpm --filter @hierarchidb/location-plugin typecheck` failed with TS1005 until the file was renamed to `.tsx`.

- Observation: TransformConfigSection hook needed unused import cleanup after extraction.
  Evidence: `pnpm --filter @hierarchidb/shape-plugin typecheck` failed with TS6133 until the unused import was removed.

- Observation: TabularDataFilterStep hook needed mode/disabled passthrough after extraction.
  Evidence: `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck` failed with TS2345 until mode/disabled were forwarded.

- Observation: ValidationConfigStep view hook needed form data typing instead of full ValidationRule.
  Evidence: `pnpm --filter @hierarchidb/resolver-plugin typecheck` failed with TS2741 until the hook type was loosened.

## Decision Log

- Decision: Start extraction with basemap-plugin before larger location/route components.
  Rationale: Basemap components are medium-sized and allow validating the extraction pattern with lower risk.
  Date/Author: 2026-02-01 / Codex.

- Decision: Use one custom hook per component, stored in a sibling file named `use<PascalCaseComponent>.ts`.
  Rationale: Keeps ownership local, avoids re-export policy violations, and matches existing conventions in the repo.
  Date/Author: 2026-02-01 / Codex.

## Outcomes & Retrospective

- Outcome: Pending.

## Context and Orientation

The targets are TypeScript React components under `plugins/**/src/**/*.tsx`. These files often blend view markup with state management, effects, data formatting, selection logic, and event handlers. The refactor keeps UI output identical while relocating non-view logic into a hook. Hooks should be in the same directory as the component file. The repository disallows re-exports except for `src/index.ts` or top-level index files tied to package exports, so the hook should be imported directly by the component.

Key constraints and conventions:

- Keep component props and external behavior unchanged.
- The hook must be a named function exported from its file (no default export), returning the minimum values the component needs to render.
- Avoid introducing new dependencies or modifying unrelated files.
- Comments and docs must be in English; the linked GitHub Issue stays in Japanese.

## Plan of Work

First, build an inventory of `plugins/**/*.tsx` files and classify them into two groups: (1) pure view components with minimal logic and (2) components that mix UI with heavy state/effect/handler logic. Focus on the second group. For each target component, create a sibling hook file named `use<PascalCaseComponent>.ts`. Move non-view logic into the hook: state hooks, memoization, derived data, callbacks, event handlers, and side-effect wiring. Keep JSX-only helpers or small presentational subcomponents in the component file. Replace in-component logic with a call to the hook and use its returned values for rendering.

Work plugin-by-plugin to keep changes localized. For each plugin, complete extraction for all chosen components before moving to the next plugin. After each plugin batch, run that plugin's typecheck so errors are isolated.

## Concrete Steps

Run the following from the repository root:

1) Build the inventory of plugin TSX files.

   - Command: `rg --files -g "*.tsx" plugins`
   - Record candidate components that exceed ~150 lines or contain multiple hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) and complex data/selection logic.

2) For each target component, extract logic into a hook.

   - Inspect component: `sed -n '1,220p' <file>` (repeat as needed).
   - Create hook file next to component, e.g. `plugins/<plugin>/src/.../use<PascalCaseComponent>.ts`.
   - Move state/effects/handlers into the hook.
   - Update component to call the hook and use returned values.

3) After each plugin batch, run typecheck.

   - Command: `pnpm --filter @hierarchidb/<plugin> typecheck`
   - Expected: exit code 0.

Example expected transcript:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  > @hierarchidb/shape-plugin@0.1.0 typecheck ...
  > tsc --noEmit

4) Update the linked GitHub Issue with progress and completion notes for each batch.

## Validation and Acceptance

- Each targeted component has a sibling hook file and delegates non-view logic to it.
- Rendering output and behavior are unchanged when the component is exercised manually.
- `pnpm --filter @hierarchidb/<plugin> typecheck` exits with code 0 for every modified plugin.
- the linked GitHub Issue contains start/update/done logs with commands and outcomes.

## Idempotence and Recovery

Edits are source-only and can be applied incrementally per component. If an extraction introduces errors, revert the hook file and component pair for that component and retry with smaller steps. No data migrations or destructive operations are involved.

## Artifacts and Notes

Provide small diffs for each component/hook pair if the changes are reviewed. Keep diffs focused on one component at a time.

## Interfaces and Dependencies

Use React hooks already present in the component. Do not introduce new dependencies. Hook signatures should align with the component props, for example:

  function useFoo(props: FooProps) {
    // state, effects, handlers
    return { ... };
  }
Plan change note: Updated progress for basemap-plugin extraction, recorded typecheck run, and logged starting plugin choice.
Plan change note: Updated progress for styler-plugin extraction, recorded typecheck run, and noted hook param typing adjustment.
Plan change note: Updated progress for shape-plugin extraction and recorded typecheck run.
Plan change note: Updated progress for location-plugin extraction, recorded typecheck run, and noted type-only import fix.
Plan change note: Updated progress for route-plugin extraction and recorded typecheck run.
Plan change note: Updated progress for shape/location/route extractions, recorded typecheck runs, and noted cleanup of unused constants in LocationStyleConfigPanel.
Plan change note: Updated progress for location-plugin LocationDataSourceStep extraction and recorded typecheck run.
Plan change note: Updated progress for location-plugin LocationMapPreviewStep extraction and recorded typecheck run.
Plan change note: Updated progress for route-plugin RouteSelectionStep and shape-plugin TransformConfigSection extractions with typecheck runs.
Plan change note: Updated progress for route-plugin RoutePreviewStep and spreadsheet-plugin TabularDataFilterStep with typecheck runs.
Plan change note: Updated progress for resolver-plugin ValidationConfigStep extraction and typecheck reruns.
