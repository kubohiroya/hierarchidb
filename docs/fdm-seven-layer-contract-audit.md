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
- GraphQL objects for workflow, ruleset governance, baseline space, space fork, or cross-space lineage
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
- Dedicated run/job lifecycle, workflow projection, ruleset governance, and lifecycle-aware space mutation stay gated until the matching ide-gsm schema capabilities are available.

## Dashboard adapter implementation

The concrete current-schema dashboard adapter is `createIdeGsmFdmDashboardPort` in `plugins/fdm-plugin/src/ui/dashboard/createIdeGsmFdmDashboardPort.ts`.

The adapter maps `FdmDashboardPort.loadDashboard` to `IdeGsmClient.fdmDashboardStatus` and preserves the current upstream input naming:

- Dashboard status filters use `timeline`.
- Returned cells may still expose `checkpoint`; the adapter keeps it as a legacy compatibility alias while producing canonical `timeline`.
- Cell detail and cell log requests map the selected canonical dashboard cell identity into the current `IdeGsmClient.fdmCellDetail` / `IdeGsmClient.subscribeFdmCellLog` input shape.
- `run-selected` is wired through `IdeGsmClient.fdmSweep` for a selected dashboard cell. The adapter reloads the current dashboard, resolves the selected cell by canonical cell ID, sends `parameterSet` / `dataset` / `computeEngine` / `timeline` selectors, and reloads status after the mutation returns.

Runtime event subscriptions remain blocked because `subscribeFdmRuntimeEvents` requires a safe `projectRelativePath` resolution path from the linked ide-gsm project root; `FdmNodeData` does not carry that server project path directly.

## Shared fixture layout

Shared fixtures for this migration live under `packages/fdm-api/src/__fixtures__/fdm-seven-layer/`.
Each layer directory is intentionally small at this stage; later issues should add executable schema/client/dashboard fixtures without creating divergent local terminology.
