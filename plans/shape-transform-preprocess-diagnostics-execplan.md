# Shape transform simplify diagnostics and preprocessing guardrails

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

Users need to understand why simplify preprocessing is dropping valid geometry during the shape build, and they need to see those problem spots in the preview map. After this change, a user running the shape pipeline (geoboundaries, Japan, ADM0/ADM1) can inspect structured logs and an on-map overlay that pinpoint the problematic rings/vertices and the reason they were rejected, and the preprocessing rules will preserve valid major polygons (Hokkaido, Honshu, etc.) instead of discarding them prematurely.

## Progress

- [x] (2026-01-18 00:30 JST) Created the task entry in TASKS.md and started the ExecPlan draft.
- [x] (2026-01-18 00:35 JST) Identified transform preprocessing and error-record paths in `packages/vt-orchestrator/src/transform/geometry.ts` and `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`.
- [x] (2026-01-18 00:40 JST) Confirmed preview overlay is driven by `ShapeTransformErrorRecord.lineFeatures` in Step6 (`plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`).
- [x] (2026-01-19 09:20 JST) Added simplify issue tracking hooks and relaxed ring/self-intersection area filtering to retain major polygons.
- [x] (2026-01-19 09:35 JST) Extended transform error records and line features with issue stage/kind and added structured simplify-drop logging.
- [x] (2026-01-19 10:05 JST) Updated Step6 preview overlay to color error lines by issueKind.
- [x] (2026-01-19 10:16 JST) Ran `pnpm typecheck` after rebuilding plugin-service-api (exit 0, tsdown define warning).

## Surprises & Discoveries

- Observation: The transform stage already captures `ShapeTransformErrorRecord` and line features for rings when simplify fails.
  Evidence: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` builds `lineFeatures` and writes to `ephemeralDB.transformErrors`, which Step6 converts into `errorLineCollection`.
- Observation: `ShapeTransformErrorRecord` is already used as the UI overlay source, so adding issue metadata there avoids extra storage or UI plumbing.
  Evidence: Step6 reads `transformErrors` and maps `lineFeatures` into the preview layers.

## Decision Log

- Decision: Use the existing `transformErrors` storage and Step6 overlay as the primary visualization surface, extending it with issue categories instead of introducing a new storage table.
  Rationale: The error-record path already exists and is visible in the UI, making the changes incremental and easier to validate.
  Date/Author: 2026-01-18 / Codex

## Outcomes & Retrospective

- Pending. This section will be updated after the diagnostics and preprocessing changes are validated on the Japan ADM0/ADM1 scenario.

## Context and Orientation

The shape build pipeline has three stages: fetch, transform, and vt. This plan focuses on the transform stage, specifically the simplify preprocessing steps. The simplify pipeline lives in `packages/vt-orchestrator/src/transform/geometry.ts` and is invoked from `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`. Preprocessing includes snapping coordinates to a grid, cleaning coordinates, fixing rings, excluding small polygons, and resolving self-intersections before simplification. Errors are captured as `ShapeTransformErrorRecord` in `packages/plugin-service-api/src/types/shapeBuildTypes.ts` and stored in the `transformErrors` table of `packages/features/shape-store/src/EphemeralShapeDB.ts`. Step6 preview uses `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` to load `transformErrors` and renders `errorLineCollection` overlays in `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts`.

Terms defined for this plan:

Simplify preprocessing: The sequence in `simplifyFeatureCollection` that runs before `simplifyGeometryInMercator`, including snap, clean, ring fix, area exclusion, and self-intersection fix.

Ring fix: The function `applyRingFix` that normalizes rings, removes duplicates/collinear points, and drops rings below size/area thresholds.

Self-intersection fix: The function `applySelfIntersectionFix` that splits or prunes polygons based on self-intersection strategy and minimum area rules.

Transform errors: Records stored in `shape-ephemeral` that include `lineFeatures` for visualization.

## Plan of Work

Start by restructuring transform-stage logging to be concise but information-rich. Replace broad console warning strings with structured logs keyed by event names and include nodeId, bandIndex, sourceKey, and featureId. Introduce a diagnostic object collected per feature/polygon during preprocessing that includes which step rejected or modified geometry (snap, clean, ring fix, area exclusion, self-intersection fix). This data should feed both logs and error records.

Next, extend `ShapeTransformErrorRecord` (and the stored line features) with a small, explicit issue category and stage, such as `issueStage: 'snap' | 'clean' | 'ringFix' | 'areaExclusion' | 'selfIntersection' | 'simplify'` and `issueKind: 'invalidRing' | 'openRing' | 'degenerateRing' | 'nonFinite' | 'droppedPolygon' | 'splitPolygon'`. These fields should be optional to preserve compatibility. Use this category to color overlays in Step6. Keep the overlay minimal: one layer for error outlines, one for selected errors, and a small legend indicating category colors. Do not introduce new UI settings unless required.

Then, address the over-aggressive preprocessing. Inspect the conditions in `applyRingFix`, `applySelfIntersectionFix`, and `applyPolygonAreaExclusion` that drop entire polygons and consider adjustments that keep the outer ring if it is valid, even when some holes or small polygons are invalid. For the Japan ADM0/ADM1 scenario, explicitly verify that the largest polygons are retained by adjusting `dropInvalidHoles` handling and the minimum area logic, while still removing clearly invalid rings or self-intersection fragments. Document the rule changes and why they preserve expected geography.

Finally, update Step6 preview to surface these diagnostics by mapping the new error record fields into `errorLineCollection` properties and applying corresponding styles in `useShapePreviewStepView.ts`. The preview should make it obvious which stage caused the drop or modification.

## Concrete Steps

1) Review and document the current preprocessing flow in `packages/vt-orchestrator/src/transform/geometry.ts`, focusing on `simplifyFeatureCollection`, `applyRingFix`, and `applySelfIntersectionFix`. Capture which step triggers drops and how the counters are logged today.

   Expected output (notes, not code):
     - A short summary of the drop conditions and where they occur (snap, clean, ring fix, area, intersection).

2) Add per-feature diagnostic accumulation in `simplifyFeatureCollection`. Each time a feature is dropped, collect a `SimplifyIssue` record including stage, reason, ring/polygon indices (if applicable), and a short message. Pass a reduced set of these issues to the caller for logging and persistence.

3) Extend `ShapeTransformErrorRecord` with optional `issueStage` and `issueKind` fields and include them when building error records in `createTransformByBandHandler.ts`. Make sure Dexie schema stays compatible by keeping existing primary keys and indexes unchanged.

4) Update the error line features to carry the issue metadata in `properties` so the Step6 overlay can style by category. Keep the properties small and consistent (e.g., `{ issueStage: 'ringFix', issueKind: 'openRing' }`).

5) Update Step6 preview overlay styles in `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts` to color error lines by issue category. Add a minimal legend or label group in the Step6 UI to explain categories, reusing existing styles if possible.

6) Adjust preprocessing logic to reduce over-pruning. Prioritize changes in:
   - `applyRingFix`: keep outer rings when only holes are invalid; use `dropInvalidHoles` only for holes, not outer rings.
   - `applySelfIntersectionFix`: when `dropSmallPolygons` is enabled, ensure the largest polygon survives even if some fragments are below threshold.
   - `applyPolygonAreaExclusion`: only exclude polygons below threshold after confirming their area relative to the largest polygon in the feature, preventing loss of major landmasses.

7) Run `pnpm typecheck` at the repository root and record the result in TASKS.md.

## Validation and Acceptance

Run a build on geoboundaries Japan for ADM0 and ADM1, then open Step6 preview. Confirm that:

1) The transform stage logs show structured diagnostics with featureId and issue category, and do not spam redundant counts.
2) The preview map displays error overlays with distinct colors for issue categories.
3) Hokkaido and Honshu are still present after preprocessing, and drop logs show only the intended invalid rings or small polygons.
4) `pnpm typecheck` completes with exit 0.

## Idempotence and Recovery

All changes are code-only and safe to re-run. If the updated preprocessing logic produces worse results, revert the commit(s) touching `packages/vt-orchestrator/src/transform/geometry.ts` and `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` to restore previous behavior. If the UI overlays are undesirable, revert the Step6 overlay adjustments.

## Artifacts and Notes

Include in the final PR summary a small excerpt of the new log format showing issue categories and feature IDs, and a screenshot of Step6 preview with error overlays for Japan ADM0/ADM1.

## Interfaces and Dependencies

Key interfaces:

- `PreSimplifyFilterConfig` in `packages/features/gis-sdk/src/config.ts` controls preprocessing behavior. Do not add new required fields without updating defaults and UI.
- `ShapeTransformErrorRecord` in `packages/plugin-service-api/src/types/shapeBuildTypes.ts` stores error diagnostics and line features used in Step6.
- `simplifyFeatureCollection` in `packages/vt-orchestrator/src/transform/geometry.ts` is the core preprocessing entry point.

No new dependencies are required. Use existing MapLibre overlays in Step6 and the existing error record storage.

Plan change note: Initial ExecPlan created on 2026-01-18 to address simplify preprocessing diagnostics, visualization, and overly aggressive drop logic for geoboundaries Japan ADM0/ADM1.
