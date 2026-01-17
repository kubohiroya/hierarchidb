# Extract UI Logic Into Custom Hooks For Large React Components

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

Large UI components in this repo embed business logic, state orchestration, and effect wiring directly in the component body. The goal is to extract that non-view logic into per-component custom hooks stored in separate files, while keeping the rendered UI identical. After this change, each targeted component reads its state and handlers from a `use*` hook next to it, which makes the component easier to read, test, and evolve. Success is visible by inspecting the component files and by running typecheck; the UI should behave the same as before.

## Progress

- [x] (2026-01-17 17:05 JST) Identified large TSX components (>=200 lines) lacking local custom hook extraction for packages, app, and plugins.
- [x] (2026-01-17 18:00 JST) Defined hook file naming convention and per-component extraction rules in this plan.
- [x] (2026-01-17 18:05 JST) Extracted hooks for app/src components (LicenseInfo, HomePage, TagsPage, PluginDialogRoute) and updated imports.
- [x] (2026-01-17 18:25 JST) Extracted hooks for plugins/*/src components and updated imports (resolver steps, folder inputs, styler, basemap, spreadsheet).
- [x] (2026-01-17 18:45 JST) Validated with `pnpm typecheck` and updated TASKS.md logs.

## Surprises & Discoveries

- Observation: `plugins/location-plugin/src/ui/components/steps-provider.tsx` is not a React component, so it stayed out of scope.
  Evidence: File contains context/provider wiring without JSX component export.

## Decision Log

- Decision: Use one custom hook per component, defined in a sibling file named `use<PascalCaseComponent>.ts`.
  Rationale: Keeps ownership localized and avoids re-export policy violations.
  Date/Author: 2026-01-17 / Codex.

## Outcomes & Retrospective

- Outcome: Large app and plugin components now delegate non-view logic to adjacent `use*` hooks, keeping JSX-only files shorter and easier to scan.
- Outcome: Typecheck succeeded after cleanup of unused imports/types, regex escaping, and return shape alignment (`pnpm typecheck` exit 0).

## Context and Orientation

The targets are large React components under `app/src` and `plugins/*/src` that were previously listed as >=200 lines and do not define/import local custom hooks. These components currently mix view rendering (JSX) with state, effect, and handler logic. This refactor will move non-view logic into hook files located next to each component file.

Relevant files to modify (initial list, to be confirmed per file):

- app/src/router/pages/info/LicenseInfo.tsx
- app/src/router/routes/tags.($uuid).tsx
- app/src/router/routes/tree/PluginDialogRoute.tsx
- app/src/router/pages/home/HomePage.tsx
- plugins/resolver-plugin/src/ui/components/steps/PreviewTestStep.tsx
- plugins/resolver-plugin/src/ui/components/steps/ValidationConfigStep.tsx
- plugins/resolver-plugin/src/ui/components/ResolverPanel.tsx
- plugins/location-plugin/src/ui/components/steps-provider.tsx
- plugins/styler-plugin/src/ui/components/StylerTargetStep.tsx
- plugins/resolver-plugin/src/ui/components/steps/DuplicateResolutionStep.tsx
- plugins/folder-plugin/src/ui/components/TagInput.tsx
- plugins/basemap-plugin/src/ui/components/BaseMapPreview.tsx
- plugins/folder-plugin/src/ui/components/CategorySelector.tsx
- plugins/spreadsheet-plugin/src/ui/components/ValueHistogram.tsx

The repo disallows re-exports except `src/index.ts` or top-level index files tied to package.json exports. New hook files must be imported directly by the component and should not introduce re-export layers.

## Plan of Work

First, define the extraction rule: move state declarations (useState/useReducer/useMemo/useCallback), derived values, effects (useEffect/useLayoutEffect), event handlers, and non-visual helper logic into a hook file. Leave presentational subcomponents or JSX-only helpers inside the component file if they are tightly tied to rendering. The hook should return the minimum set of values and callbacks needed by the component for rendering.

For each target component:

- Create a new hook file in the same directory named `use<PascalCaseComponent>.ts`.
- Move non-view logic into the hook. Export a single hook function.
- Replace in-component logic with a call to the hook and use returned values.
- Ensure the component props and hook arguments align; pass props into the hook where needed.
- Keep the public component signature unchanged.
- Do not change behavior, state shape, or side effects.

Proceed in this order to keep changes manageable:

1) app/src components, top-down order as listed above.
2) plugins components, grouped by plugin to avoid interleaving unrelated changes.

Update TASKS.md logs after each logical batch and record any blocked items.

## Concrete Steps

Run these commands from the repository root:

1) Inspect each target file to understand its state/effects/handlers.
   - Command: `sed -n '1,220p' <file>` (repeat per file as needed)

2) Create hook files and update components.
   - Command: edit with apply_patch or cat > file, keeping file-local changes grouped by component.

3) Validate typecheck once all edits are complete.
   - Command: `pnpm typecheck`
   - Expected: exit code 0.

Example transcript (illustrative):

  $ pnpm typecheck
  ...
  Done in 42.3s.

## Validation and Acceptance

- Components compile and typecheck passes (`pnpm typecheck` exit 0).
- Each target component calls a new custom hook defined in a sibling file.
- The hook file contains the non-view logic that previously existed in the component body.
- No behavior changes are introduced; props and rendering output remain the same.

## Idempotence and Recovery

Edits are source-only and can be applied incrementally. If any extraction introduces errors, revert the local hook file and component file for that component and re-apply with smaller changes. No data migrations are involved.

## Artifacts and Notes

No artifacts yet. Provide short diffs for each component/hook pair if needed during review.

## Interfaces and Dependencies

Use React hooks already present in the component files. Do not introduce new dependencies. Hook signatures should mirror the component props or the minimal subset used by the logic, for example:

  function useFoo(props: FooProps) {
    // state, effects, handlers
    return { ... };
  }

The component should import the hook via a relative path and call it once at the top level.

---

Plan change log: 2026-01-17 created initial ExecPlan for extracting hooks from app and plugins components listed in TASKS.md.
