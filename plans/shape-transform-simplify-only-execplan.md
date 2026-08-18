# Simplify-only Transform Mode Cleanup

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` at the repository root and must be maintained in accordance with those requirements.

## Purpose / Big Picture

Users will have a single, reliable transform path that uses simplify-only processing with Ramer–Douglas–Peucker (RDP) simplification and no full-mode geometry repair or quantization steps. The Step4 UI will only expose settings that affect this simplify-only pipeline, eliminating controls that do nothing in practice. The result is less confusion, fewer failure modes, and a consistent, memory-safe pipeline. Success is observable by opening the Shape step4 UI and verifying only simplify-only relevant controls remain, and by running typecheck successfully.

## Progress

- [x] (2026-01-25 03:30Z) Create this ExecPlan and keep it updated as decisions are made.
- [x] Identify all transform-mode branching, simplify-only usage, and full-only configuration fields.
- [x] Remove full-mode branches and related code paths in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`.
- [x] Remove or restructure full-only configuration fields in `packages//src/config.ts` and default config in `plugins/shape-plugin/src/common/types/constants.ts`.
- [x] Update shape plugin UI to remove simplify-only-ineffective controls and align i18n.
- [x] Update tests and fixtures that reference removed config fields.
- [x] Run `pnpm typecheck` and capture output summary in the retired local task log.
- [x] Record decisions, discoveries, and retrospective.

## Surprises & Discoveries

- Observation: No unexpected behavior beyond the known tsdown `define` warning.
  Evidence: `pnpm typecheck` output during @hierarchidb/plugin-base build.

## Decision Log

- Decision: Remove full transform mode and keep simplify-only as the only supported path.
  Rationale: Full mode causes memory pressure and is not viable in practice; simplify-only provides acceptable quality/performance tradeoff.
  Date/Author: 2026-01-25 / Codex

## Outcomes & Retrospective

- Full transform mode code paths removed from vt orchestrator; simplify-only is the sole transform path.
- Transform config/UI/i18n now expose only simplify-only relevant settings; quantize and repair settings removed.
- Tests and fixtures updated; `pnpm typecheck` passes with existing tsdown `define` warning.

## Context and Orientation

The shape transform pipeline lives in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`. It currently branches between `simplify-only` and `full` transform modes. The simplify-only branch calls `simplifyOnlyCollection`, while the full branch calls `simplifyFeatureCollection` and performs additional geometry repair steps (ring fixes, self-intersection handling, pre-simplify filtering, quantization, and error record persistence). The shape plugin’s Step4 UI in `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx` exposes controls for both paths, and the configuration types live in `packages//src/config.ts` with defaults in `plugins/shape-plugin/src/common/types/constants.ts`.

In this repo, “transform mode” refers to which simplify pipeline is used in `createTransformByBandHandler.ts`. “Simplify-only” means we only apply RDP simplification (and area-based tolerance adjustment) without quantization or geometry repair steps. “Full mode” refers to the branch that uses quantization and self-intersection repair logic.

## Plan of Work

First, identify every usage of `transformMode` and any configuration fields used only in the full branch. This includes config types, defaults, UI controls, and test fixtures. Then remove the full-branch logic from `createTransformByBandHandler.ts`, including its logs and error record paths, and remove any now-unused helpers if they have no callers. Next, simplify configuration by removing full-only fields from the config type and default config, and adjust any code that read or merged those fields. Finally, remove or hide UI controls that no longer affect simplify-only processing and update i18n strings to reflect the remaining configuration. Update tests/fixtures to match the new config shape. Run `pnpm typecheck` to validate the refactor.

## Concrete Steps

Work in `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Search for `transformMode`, `simplifyFeatureCollection`, and full-only config fields. Note all files and decide what must be removed or reworked.

2) Edit `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` to remove the full-mode branch and any logs or error record logic that only applies to it. Ensure the simplify-only flow remains and still reports progress and errors sensibly.

3) Edit `packages//src/config.ts` and `plugins/shape-plugin/src/common/types/constants.ts` to remove full-only configuration fields (for example, self-intersection and pre-simplify filter settings) or to move any remaining required values to simplify-only paths if needed.

4) Edit `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx` to remove UI controls that do not affect simplify-only behavior. Update i18n strings in `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json` accordingly.

5) Update tests and fixtures in `plugins/shape-plugin/src/**/__tests__/**` that rely on removed config fields.

6) Run `pnpm typecheck` at the repo root and record the command output summary in the linked GitHub Issue.

## Validation and Acceptance

Run `pnpm typecheck` from the repo root. Expect exit code 0. In the UI, Step4 should no longer display controls that only applied to full transform mode, and only simplify-only relevant controls remain. The transform pipeline should always execute the simplify-only path, with no references to full-mode settings.

## Idempotence and Recovery

Edits are safe to re-apply and should be idempotent. If the refactor breaks behavior, revert the changes described in this plan to restore full-mode branching and the prior UI, then re-run `pnpm typecheck`.

## Artifacts and Notes

Include brief `pnpm typecheck` output summaries in the linked GitHub Issue for verification.

## Interfaces and Dependencies

No new external dependencies are required. All changes are contained within the shape pipeline and UI modules. The primary interfaces are:

- `packages//src/config.ts` `ShapeTransformConfig`
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`


Change log: Initial plan created on 2026-01-25 to remove full-mode transform support and simplify UI/configuration. Updated progress and discoveries after simplify-only refactor and typecheck.
