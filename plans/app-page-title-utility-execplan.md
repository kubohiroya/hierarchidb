# Centralize App Page Titles

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

Users should see consistent, meaningful page titles across the app, with the application name appended in a uniform way. Dialog step titles must be resolved from the current step number and locale using plugin manifest metadata. After this change, navigating to the specified URLs will show titles like "Build: New Shape - ERIA-Cartograph" or "Info - ERIA-Cartograph" in the browser tab, and the home page will show only the app name. This is visible immediately by visiting the routes and observing the browser tab title.

## Progress

- [x] (2026-02-15 07:38 JST) Created the ExecPlan and recorded the current context and acceptance requirements.
- [x] (2026-02-15 08:02 JST) Implemented centralized title utility and integrated it into required routes/pages.
- [x] (2026-02-15 09:24 JST) Added step title metadata to plugin manifests and exposed a shared step-title resolver API.
- [x] (2026-02-15 09:28 JST) Updated resolver/styler/spreadsheet/route i18n resources to support step title resolution.
- [x] (2026-02-15 09:31 JST) Regenerated the plugin registry and rebuilt plugin-base/plugin-registry types.
- [x] (2026-02-15 09:33 JST) Ran app typecheck after step-title integration (exit 0).
- [ ] Validate title behavior across the required URLs in a running app session.

## Surprises & Discoveries

- Observation: TypeScript rejected `includes()` against the dialog route ID tuple because match route IDs are `string`.
  Evidence: `src/router/title/pageTitle.ts(75,71): error TS2345` during initial typecheck.
- Observation: Typecheck initially failed because plugin-base and plugin-registry dist typings did not include the new manifest fields/exports.
  Evidence: `route-plugin/src/plugin-manifest.ts` and app route typecheck errors until the builds were rerun.

## Decision Log

- Decision: Create a single title utility that formats app name suffixes and exposes hooks for document title updates.
  Rationale: Centralizes title string construction without coupling routing logic to individual components.
  Date/Author: 2026-02-15 (Codex)
- Decision: Use a `Set<string>` for dialog route ID matching to avoid string/union mismatches.
  Rationale: Keeps the routing logic simple and type-safe while preserving the intended match semantics.
  Date/Author: 2026-02-15 (Codex)
- Decision: Resolve dialog step titles from plugin manifest metadata using a shared resolver API and locale-aware translation.
  Rationale: Avoids app → plugin coupling while keeping step title localization consistent across plugins.
  Date/Author: 2026-02-15 (Codex)
- Decision: Treat `basicInfo` as a common step key mapped to `common.basicInfo.title` rather than duplicating the label in every plugin locale.
  Rationale: Keeps plugin i18n resources focused on plugin-specific steps without introducing fallback behavior.
  Date/Author: 2026-02-15 (Codex)

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Document titles are currently set in a limited way. Only the tree layout route (`app/src/router/routes/t.($treeId).($pageNodeId).tsx`) writes `document.title` directly, while other pages rely on local component titles or a `meta()` helper that is not wired into TanStack Router. The task requires a centralized utility under the `app/` package that composes page titles, appends `VITE_APP_NAME` when present, and is used by every relevant page.

Key files and responsibilities:

- `app/src/router/routes/t.($treeId).($pageNodeId).tsx`: Tree layout route; currently sets document.title based on loader data.
- `app/src/router/routes/tree/tagsRoute.tsx`: Tags list route under `/t/:treeId/:pageNodeId/tags`.
- `app/src/router/routes/tags.($tagName).tsx`: Tag detail page component used by tree tag detail route.
- `app/src/router/routes/utilityRoutes.tsx` and `app/src/router/routes/plugins.tsx`: `/plugin-loaders` route and its page.
- `app/src/router/routes/infoRoute.tsx` and `app/src/router/pages/info/InfoPage.tsx`: `/info` route and view.
- `app/src/router/pages/home/HomePage.tsx`: home page for `/`.
- `app/src/loadAppConfig.ts`: returns `appName` from `VITE_APP_NAME` and defaults.

The new utility must be referenced from these routes/pages to set `document.title` consistently. A "page title" in this plan means the string before app name suffix (for example, "Build: New Shape"), while the full document title includes the suffix (for example, "Build: New Shape - ERIA-Cartograph").

## Plan of Work

Create a new module in `app/src/router/title/` that exposes helpers to build full document titles from a base page title and the application name. The helper must read the app name via `loadAppConfig()` (which already reflects `VITE_APP_NAME`) and provide a hook that updates `document.title` inside `useEffect`.

Update the tree layout route to use this utility to compute titles based on route matches. The logic should:

- Use `draftMetadata.name` when present, otherwise `metadata.name`.
- When the match is the dialog step route (route id `/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step`), set the page title to `Build: <NodeName>`.
- When the match is a tag list or tag detail route, set page titles to `tags` or `<tagName>` respectively.
- Otherwise, prefer target node name, then page node name, then tree name, with a fallback to the app name.

Update other routes to call the hook with the correct base title:

- Home page (`/`) uses app name only.
- Info page uses `Info`.
- Plugin loaders page uses `plugin-loaders`.
- Tags list/detail pages ensure titles show `tags` or the tag name, matching the specified paths.

Keep changes minimal and avoid altering unrelated UI strings.

## Concrete Steps

1) Add `app/src/router/title/pageTitle.ts` (or similarly named) containing:
   - `getAppName()` that returns `loadAppConfig().appName`.
   - `formatAppTitle(pageTitle, appName, { appNameOnly })` that appends the suffix or returns the app name only.
   - `useAppDocumentTitle(pageTitle, { appNameOnly })` that updates `document.title`.
   - `resolveNodeDisplayName(node)` that prefers `draftMetadata.name` over `metadata.name`.

2) Update `app/src/router/routes/t.($treeId).($pageNodeId).tsx` to replace inline title logic with:
   - A computed base title that respects dialog step routes (Build), tag routes, target routes, and page routes.
   - `useAppDocumentTitle` to set `document.title` with app name suffix.

3) Update home, info, plugin loaders, and tag pages to call `useAppDocumentTitle` with the appropriate base title.

4) Run `pnpm -w turbo run typecheck --filter @hierarchidb/app` from repository root and confirm exit 0.

## Validation and Acceptance

Navigate to the following URLs and verify the browser tab title matches expectations (with the app name set to `ERIA-Cartograph`):

- `/` -> `ERIA-Cartograph`
- `/info` -> `Info - ERIA-Cartograph`
- `/plugin-loaders` -> `plugin-loaders - ERIA-Cartograph`
- `/t/r/` -> `Resources - ERIA-Cartograph`
- `/t/r/r:3Aroot/<nodeId>` -> `<NodeName> - ERIA-Cartograph`
- `/t/r/r:3Aroot/<nodeId>/shape/edit/maximize/5` -> `Build: <NodeName> - ERIA-Cartograph`
- `/t/r/r%3Aroot/tags` -> `tags - ERIA-Cartograph`
- `/t/r/r%3Aroot/tags/<tagName>` -> `<tagName> - ERIA-Cartograph`

Finally, run the typecheck command and expect exit 0.

## Idempotence and Recovery

The changes are safe to reapply; re-running the update will overwrite the same title logic. To roll back, revert the new title utility module and restore the previous inline document.title usage.

## Artifacts and Notes

Typecheck (post-step-title integration):
  pnpm -w turbo run typecheck --filter @hierarchidb/app
  Tasks: 126 successful, 126 total
  Status: exit 0 (tsdown warning about `define` persists)

## Interfaces and Dependencies

The utility depends on:

- `loadAppConfig()` from `app/src/loadAppConfig.ts` for app name.
- `TreeNode` shape for metadata/draftMetadata fields.
- Route IDs from `app/src/router/routes/tree/shared.ts` for distinguishing tree subroutes.

Plan update note (2026-02-15 08:06 JST): Updated progress after implementation and recorded the typecheck evidence and route ID typing fix.
