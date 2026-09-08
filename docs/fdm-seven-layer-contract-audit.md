# FDM seven-layer contract audit

This note records the hierarchidb-side implementation baseline for the FDM seven-layer model tracked by GitHub issue #1728.

## Upstream schema baseline

- Source repository: `kubohiroya/ide-gsm`
- Baseline ref used for this implementation pass: `origin/main` at `1f0c50d32634b8e08f0d80b8ec3a9e0e447e01fb`
- Generated schema file: `api-idegsm/docs/generated/schema.graphql`
- Schema generation/check commands in ide-gsm: `./gradlew api-idegsm:updateGraphqlSchema` and `./gradlew api-idegsm:graphqlSchemaCheck`

## Confirmed upstream GraphQL surface

The current ide-gsm schema exposes the following FDM dashboard operations:

- Queries: `fdmDashboardStatus`, `fdmCellDetail`, `fdmRuntimeDiagnostics`, `fdmSpaces`, `fdmDirectoryTree`, `fdmDirectoryInfo`
- Mutations: `fdmSweep`, `fdmVerify`, `fdmFill`, `fdmCompare`, `fdmClean`, `fdmDiagnose`, `fdmSpaceCreate`, `fdmSpaceUpdate`, `fdmSpaceDelete`, `fdmDirectoryRemove`
- Subscriptions: `subscribeFdmCellLog`, `subscribeFdmRuntimeEvents`

The same schema still carries legacy dashboard field names in several places:

- `DashboardCell.checkpoint`
- `CellStageIdentity.checkpoint`
- `FdmCellDetailInput.checkpoint`
- `FdmCellLogInput.checkpoint`

The action inputs use canonical `parameterSet` / `timeline` naming:

- `FdmVerifyInput.timeline`
- `FdmVerifyInput.parameterSet`
- `FdmFillInput.timeline`
- `FdmCleanInput.timeline`
- `FdmDiagnoseInput.timeline`
- `FdmCompareInput.baselineTimeline`
- `FdmCompareInput.targetTimeline`

## Not yet available upstream

These items remain planned or gated in the #1728 issue graph and must not be assumed available in hierarchidb implementation:

- Dedicated FDM run/job lifecycle operations beyond the generic active task fields
- Live baseline-space, space-fork, and cross-space lineage GraphQL operations in hierarchidb client contracts
- FDM-specific capability keys in `ideGsmServerInfo.capabilities`

## Hierarchidb compatibility mapping

The initial implementation keeps node data version `1` and preserves existing serialized fields while adding canonical seven-layer aliases for new consumers.

| Current field | Seven-layer term | Handling |
| --- | --- | --- |
| `profile` | `parameterSet` | Accepted as a legacy alias and normalized to `parameterSet`. |
| `checkpoint` | `timeline` | Accepted as a legacy alias and normalized to `timeline`. |
| `resultRef` | `snapshot.resultRef` | Preserved and copied into a snapshot reference when no explicit snapshot exists. |
| `selectedStateDir` | runtime state directory | Preserved as local dashboard runtime context, not as space identity. |
| `spaceId` | L6 space | Preserved as the stable top-level FDM space identity. |

## Contract rules

- Dashboard responses can be normalized with `normalizeFdmDashboardResponse`.
- Legacy-only payloads produce canonical `parameterSet` and `timeline` aliases.
- Canonical-only payloads are backfilled with legacy `profile` and `checkpoint` aliases for existing UI code.
- Payloads that specify both old and new aliases with conflicting values are rejected.
- Axis maps still contain the four visible dashboard slots, but each slot can choose either legacy or canonical axis names.
- `fdmSweep` is the primary FDM sweep mutation. `fdmVerify` remains a compatibility mutation while upstream keeps exposing it.
- Dedicated run/job lifecycle and lifecycle-aware space mutation stay gated until the matching ide-gsm schema capabilities are available. L4 workflow, L5 ruleset, and L6 cross-space read-only projections are represented as optional server-provided dashboard projections; unavailable, stale, and unsupported states are displayed without client-side inference.
- Cross-space read-only projections require explicit `origin.spaceId` on each displayed item. The dashboard must not default missing origin from the selected `spaceId`.

## Dashboard adapter implementation

The concrete current-schema dashboard adapter is `createIdeGsmFdmDashboardPort` in `plugins/fdm-plugin/src/ui/dashboard/createIdeGsmFdmDashboardPort.ts`.

The adapter maps `FdmDashboardPort.loadDashboard` to `IdeGsmClient.fdmDashboardStatus` and preserves the current upstream input naming:

- Dashboard status filters use `timeline`.
- Returned cells may still expose `checkpoint`; the adapter keeps it as a legacy compatibility alias while producing canonical `timeline`.
- Cell detail and cell log requests map the selected canonical dashboard cell identity into the current `IdeGsmClient.fdmCellDetail` / `IdeGsmClient.subscribeFdmCellLog` input shape.
- Runtime event subscriptions map to `IdeGsmClient.subscribeFdmRuntimeEvents` only when the adapter is created with a resolver that returns a validated `projectRelativePath`.
- `run-selected` is wired through `IdeGsmClient.fdmSweep` for a selected dashboard cell. The adapter reloads the current dashboard, resolves the selected cell by canonical cell ID, sends `parameterSet` / `dataset` / `computeEngine` / `timeline` selectors, and reloads status after the mutation returns.

The adapter still does not infer `projectRelativePath` from `spaceId`; callers must resolve it from the linked ide-gsm project root or leave runtime event subscription unavailable.

## Shared fixture layout

Shared fixtures for this migration live under `packages/fdm-api/src/__fixtures__/fdm-seven-layer/`.
Phase B1 now keeps each layer represented by an executable fixture or an explicit gated/unavailable fixture:

| Layer | Fixture coverage | Status |
| --- | --- | --- |
| L0 timeline | `timeline` / `checkpoint` compatibility and conflict rejection | covered |
| L1 parameter set | `parameterSet` / `profile` saved-node normalization | covered |
| L2 range snapshot | `resultRef` to `snapshot.resultRef` projection | covered |
| L3 run/job | runtime-event bridge payload and forbidden credential-key rejection | covered |
| L4 workflow | workflow projection acceptance, full known enum coverage, unknown enum rejection, and representative UI states | covered |
| L5 ruleset | ruleset governance projection acceptance, fingerprint/digest display, missing issue-number visibility, and unavailable/stale UI states | covered |
| L6 space | space catalog metadata, lifecycle dry-run safety, read-only cross-space placeholder validation, and explicit origin requirements | covered, live fork/cross-space wiring still gated |

Later issues should extend these fixtures instead of creating divergent local terminology. #1732 adds read-only intake for baseline/fork/lineage capability summaries without per-space inference, #1735 owns lifecycle dry-run/safety wiring, and #1736 owns fork/cross-space read-only dashboard placeholders while live wiring waits for upstream fork/view schema names and capability keys.

## L6 lifecycle safety

`fdmSpaceDeleteDryRun` is the safe client helper for server-side FDM space delete/archive inspection. It always calls `fdmSpaceDelete` with `apply: false` and is tested separately from `fdmDirectoryRemove`. Destructive apply behavior and UI actions remain gated until the server contract provides reference-aware denial, authorization evidence, and explicit apply semantics.
