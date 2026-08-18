# Refactor shape Step4 shared UI patterns

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Shape Step4 uses repeated UI patterns for cards and section headers, which makes future UI tweaks harder and error-prone. This plan extracts the shared hover-card styling and section header layout into common utilities/components and updates Step4 sections to use them. After this change, Step4 configuration panels render the same as before, but the hover and header behavior are defined in one place. You can confirm success by running shape-plugin typecheck and verifying Step4 UI still renders correctly in the app.

## Progress

- [x] (2026-01-28 23:54 JST) Created shared hover-card style helper in `plugins/shape-plugin/src/ui/components/step4/step4CardStyles.ts`.
- [x] (2026-01-28 23:54 JST) Added shared section title component in `plugins/shape-plugin/src/ui/components/step4/Step4SectionTitle.tsx`.
- [x] (2026-01-28 23:54 JST) Replaced local hover/section title patterns in Step4 components to use shared helpers.
- [x] (2026-01-28 23:55 JST) Ran `pnpm --filter @hierarchidb/shape-plugin typecheck` and confirmed success.
- [x] (2026-01-28 23:55 JST) Updated the retired local task log with completion logs and marked the task done.

## Surprises & Discoveries

- Observation: None so far.
  Evidence: Not applicable.

## Decision Log

- Decision: Keep shared hover style in a plain helper function instead of a wrapper component.
  Rationale: Allows reuse across Paper/Card without changing component trees.
  Date/Author: 2026-01-28 (Codex).

## Outcomes & Retrospective

- Outcome: Step4 UI now uses shared hover-card styles and section title component, reducing duplication while keeping behavior stable. Typecheck passes for shape-plugin.

## Context and Orientation

Step4 configuration UI lives under `plugins/shape-plugin/src/ui/components/step4/`. Several sections implement the same hover-card effect and the same icon+title header. The files updated are:

- `FetchConfigSection.tsx`, `TransformConfigSection.tsx`, `VTConfigSection.tsx` for section headers and card hover styling.
- `CacheManagementSection.tsx`, `DownloadRetryControls.tsx`, `DeleteBuildOutputsCard.tsx`, `WorkerNumberConfigCard.tsx`, `ZoomBandRangeCard.tsx` for card hover styling.
- New shared utilities in `Step4SectionTitle.tsx` and `step4CardStyles.ts`.

## Plan of Work

Create a shared `Step4SectionTitle` component that renders an icon and subtitle, and a `getStep4HoverCardSx` helper that returns the common hover styling when not disabled. Replace local `SectionTitle` and hover-style snippets in Step4 UI components with these shared utilities. Keep the visual behavior identical by preserving existing props and spacing. Finally, run typecheck and update task logs.

## Concrete Steps

1) Add shared helpers in `plugins/shape-plugin/src/ui/components/step4/Step4SectionTitle.tsx` and `plugins/shape-plugin/src/ui/components/step4/step4CardStyles.ts`.

2) Replace local `SectionTitle` components and hover-card style objects in Step4 components with the shared helper/component.

3) Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from the repository root and record the output in the linked GitHub Issue.

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` exits 0.
- Step4 UI still displays card hover elevation and icon+title headers with no layout regressions.

## Idempotence and Recovery

The changes are safe to repeat. If the UI changes unexpectedly, revert the shared helper usage in the affected component(s) or revert the commit to restore the original local styling.

## Artifacts and Notes

Expected command transcript example:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- `Step4SectionTitle` exports a small presentational component used by Step4 sections.
- `getStep4HoverCardSx` returns an MUI sx object for the hover animation and is shared by Paper and Card usage.

Plan updated on 2026-01-28 to capture validation completion and task wrap-up.
