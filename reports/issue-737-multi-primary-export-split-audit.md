# Issue #737: Multi-Primary Export Long File Audit

## Summary
- Candidates (>=300 lines and >=2 major exports): 49
- Split applied now: 8 files
- New files created for splits: 8

## Split Applied (This PR)
- packages/ui/tone-curve-editor/src/useToneCurveEditor.ts
- packages/plugin-ui-sdk/src/hooks/useTreeNodeUpdater.ts
- packages/ui/tabular-extract/src/hooks/useTabularFilter.ts
- packages/ui/tabular-extract/src/hooks/useTabularData.ts
- packages/components/src/toast/ToastProvider.tsx
- plugins/location-plugin/src/common/i18n/index.ts
- plugins/route-plugin/src/ui/components/steps/useRouteSelectionStep.ts
- packages/runtime-worker/src/services/RouteQueryService.ts

## New Files
- packages/ui/tone-curve-editor/src/formatAnchorValueLabel.ts
- packages/plugin-ui-sdk/src/hooks/createTreeNodeUpdaterActions.ts
- packages/ui/tabular-extract/src/hooks/useTabularSelection.ts
- packages/ui/tabular-extract/src/hooks/useTabularTableList.ts
- packages/components/src/toast/useToast.ts
- plugins/location-plugin/src/common/i18n/formatters.ts
- plugins/route-plugin/src/ui/components/steps/routeSelectionConstants.ts
- packages/runtime-worker/src/services/routeQueryCacheConfig.ts

## Full Candidate List
| file | lines | majorExports | status |
|---|---:|---:|---|
| plugins/shape-plugin/src/services/build/ShapeBuildAPIClient.ts | 1046 | 8 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/services/vt/shapePipelineShared.ts | 714 | 16 | reason2-exception(reviewed) |
| plugins/styler-plugin/src/common/utils/colorUtils.ts | 646 | 13 | reason2-exception(reviewed) |
| packages/gis-sdk/src/vectorTiles.ts | 628 | 4 | reason2-exception(reviewed) |
| packages/ui/map/src/stories/ViewportFeatureCategories.stories.tsx | 603 | 2 | reason2-exception(reviewed) |
| packages/runtime-worker/src/services/StageProcessingService.ts | 542 | 4 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/services/utils/utils.ts | 534 | 14 | reason2-exception(reviewed) |
| plugins/styler-plugin/src/ui/components/StylerPreviewStep.tsx | 501 | 2 | reason2-exception(reviewed) |
| packages/backend/bff/src/index.ts | 500 | 2 | reason2-exception(reviewed) |
| plugins/basemap-plugin/src/ui/hooks/useBaseMapEntity.ts | 474 | 7 | reason2-exception(reviewed) |
| packages/ui/theme/src/theme/createTheme.ts | 471 | 2 | reason2-exception(reviewed) |
| packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts | 460 | 2 | reason2-exception(reviewed) |
| packages/ui/worker-client/src/workerBridge.ts | 446 | 4 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/services/metadata/metadataSources.ts | 435 | 3 | reason2-exception(reviewed) |
| plugins/styler-plugin/src/common/utils/dataAnalysis.ts | 429 | 6 | reason2-exception(reviewed) |
| packages/gis-sdk/src/ephemeral/EphemeralDB.ts | 421 | 2 | reason2-exception(reviewed) |
| packages/vt-orchestrator/src/transform/createTransformByBandHandler/helpers/analysis.ts | 417 | 12 | reason2-exception(reviewed) |
| packages/vt-orchestrator/src/transform/createTransformByBandHandler/helpers/core.ts | 417 | 35 | reason2-exception(reviewed) |
| packages/session-coordinator/src/index.ts | 404 | 3 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils.ts | 395 | 15 | reason2-exception(reviewed) |
| packages/ui/search-result-window/src/stories/multiSelection.stories.tsx | 390 | 3 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders.ts | 388 | 5 | reason2-exception(reviewed) |
| packages/route-api/src/ideGsmRouteCsv.ts | 369 | 4 | reason2-exception(reviewed) |
| plugins/styler-plugin/src/common/__tests__/mocks/spreadsheet-plugin.ts | 369 | 2 | reason2-exception(reviewed) |
| packages/ui/map/src/preview/MapPreviewFloatingTable.tsx | 368 | 2 | reason2-exception(reviewed) |
| plugins/folder-plugin/src/ui/components/steps-provider.tsx | 367 | 4 | reason2-exception(reviewed) |
| plugins/location-plugin/src/services/pointFactories.ts | 362 | 9 | reason2-exception(reviewed) |
| packages/styler-store/src/StylerEntity.ts | 361 | 5 | reason2-exception(reviewed) |
| packages/tools/gen-iso3166-2/src/scraper.ts | 352 | 4 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/ui/components/build-progress/tile-emit/useTileEmitTaskItemDetailPreview.ts | 349 | 2 | reason2-exception(reviewed) |
| packages/ui/map/src/components/resource-layer-map/resourceLayerMapHelpers.ts | 347 | 10 | reason2-exception(reviewed) |
| packages/components/src/toast/ToastProvider.tsx | 346 | 2 | split-applied |
| plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/useShapeBuildProgressPanelControllerOverlay/ShapeBuildProgressPanelControllerOverlayDialogsView.tsx | 346 | 5 | reason2-exception(reviewed) |
| packages/ui/map/src/types/unified-map-props.ts | 345 | 2 | reason2-exception(reviewed) |
| packages/plugin-ui-host/src/examples/SamplePluginProvider.tsx | 335 | 2 | reason2-exception(reviewed) |
| packages/vt-orchestrator/src/transform/createTransformByBandHandler/transformByBandRetrySimplify.ts | 330 | 4 | reason2-exception(reviewed) |
| plugins/location-plugin/src/common/datasources/LocationDataSourceDefinitions.ts | 328 | 12 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/ui/components/preview/internal/useShapePreviewStepUtils.ts | 328 | 28 | reason2-exception(reviewed) |
| packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts | 327 | 4 | reason2-exception(reviewed) |
| packages/backend/bff/src/utils/redirect-uri.ts | 326 | 7 | reason2-exception(reviewed) |
| packages/ui/treeconsole/treetable/src/plugin/types.ts | 326 | 3 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/ui/components/build-progress/internal/useShapeBuildStepStageState.ts | 323 | 2 | reason2-exception(reviewed) |
| plugins/shape-plugin/src/services/utils/chunkStore.ts | 319 | 23 | reason2-exception(reviewed) |
| packages/backend/bff/src/auth/callback.ts | 318 | 2 | reason2-exception(reviewed) |
| packages/ui/search-result-window/src/stories/MapHighlightProvider.stories.tsx | 317 | 4 | reason2-exception(reviewed) |
| packages/plugin-base/src/atoms/draftAtoms.ts | 312 | 19 | reason2-exception(reviewed) |
| packages/backend/bff/src/middleware/security.ts | 303 | 7 | reason2-exception(reviewed) |
| packages/tools/build-scripts/src/plugin-registry/manifest-utils.ts | 303 | 9 | reason2-exception(reviewed) |
| packages/ui/tabular-extract/src/components/useTabularDataFilter.ts | 303 | 2 | reason2-exception(reviewed) |
