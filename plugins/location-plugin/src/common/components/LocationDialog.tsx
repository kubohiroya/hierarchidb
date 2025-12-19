/**
 * Location Dialog Component composed with the headless multi-step dialog shell.
 * (Temporarily reverted to original implementation; _obsolate_common hook migration pending)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { Box, Button, Typography } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import type {
  LocationDialogProps,
  LocationDraft,
  LocationEntity,
} from '../types/index.js';
import { useTranslation } from '../i18n/index.js';
import { LocationSelectionStep } from '../../ui/components/steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from '../../ui/components/steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from '../../ui/components/steps/LocationMapPreviewStep.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';
import { listLocationPoints } from '../../services/pointRepository.js';
import { runLocationTabularBuild } from '../../worker/tabular/task.js';
import {
  TabularProvider,
  TabularDataFilter,
  TabularColumnSelect,
  TabularDataImport,
  type TabularFilterRule,
  type TabularSelectionConfig,
  type TabularColumnMapping,
} from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createLocationTabularApi } from '../tabular/createLocationTabularApi.js';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type HeadlessFooterRenderProps,
  type HeadlessHeaderRenderProps,
  type HeadlessDialogProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import type { DialogDisplayMode, DialogPosition as MultiStepDialogPosition, DialogSize as MultiStepDialogSize } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';

import {
  useTreeNodeUpdater,
  type TreeNodeUpdaterState,
  createTreeNodeUpdaterActions,
} from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useDialogViewState } from '@hierarchidb/plugin-ui-sdk';

const buildDefaultFrame = (): { size: MultiStepDialogSize; position: MultiStepDialogPosition } => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_CONCURRENCY = 4;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;

type LocationDraftPayload = Partial<LocationEntity>;

const normalizeLocationDraft = (raw: TreeNodeUpdaterState<LocationEntity> | null): LocationDraft => {
  const draftData = (raw?.draftData ?? {}) as LocationDraftPayload;

  const normalizedDraft: LocationDraftPayload = {
    ...draftData,
  };

  return {
    treeNodeId: (raw?.treeNodeId ?? '') as NodeId,
    draft: normalizedDraft,
    tags: undefined,
    dataSource: normalizedDraft.dataSource,
    tabularSourceId: normalizedDraft.tabularSourceId,
    extractConfig: normalizedDraft.extractConfig,
  };
};

const mergeLocationDraft = (current: LocationDraft, patch: Partial<LocationDraft>): LocationDraft => {
  const patchDraft = (patch.draft ?? patch) as LocationDraftPayload;
  const mergedDraft: LocationDraftPayload = {
    ...(current.draft ?? {}),
    ...patchDraft,
    ...(patch.dataSource ? { dataSource: patch.dataSource } : {}),
    ...(patch.tabularSourceId ? { tabularSourceId: patch.tabularSourceId } : {}),
    ...(patch.extractConfig ? { extractConfig: patch.extractConfig } : {}),
  };

  const nextDataSource = patch.dataSource ?? mergedDraft.dataSource ?? current.dataSource;
  const nextTabularSourceId = patch.tabularSourceId ?? mergedDraft.tabularSourceId ?? current.tabularSourceId;

  return {
    ...current,
    ...patch,
    draft: mergedDraft,
    tags: patch.tags ?? current.tags,
    dataSource: nextDataSource,
    tabularSourceId: nextTabularSourceId,
    extractConfig: mergedDraft.extractConfig ?? patch.extractConfig ?? current.extractConfig,
  };
};

const toDraftDataPayload = (
  value: LocationDraft
): TreeNodeUpdaterState<LocationEntity> => ({
  treeNodeId: value.treeNodeId ?? ('' as NodeId),
  draftMetadata: {
    name: value.name ?? '',
    description: value.description ?? '',
    tags: value.tags ?? [],
  },
  draftData: (value.draft ?? {}) as LocationEntity,
  dialogUIState: value.dialogUIState ?? {},
});

export const LocationDialog: React.FC<LocationDialogProps> = ({
  mode,
  nodeId,
  parentId,
  treeId,
  open,
  onClose,
  onSuccess,
  onError,
}) => {
  const { translations } = useTranslation();
  const { size: initialSize, position: initialPositionValue } = useMemo(buildDefaultFrame, []);
  const { dialogViewState, updateDialogViewState } = useDialogViewState({
    initialSize,
    initialPosition: initialPositionValue,
    initialDisplayMode: 'normal',
    initialActiveStepIndex: 0,
  });

  const workerClient = useMemo<WorkerClientRef | null>(() => {
    try {
      const hook = getWorkerClientHook<WorkerClientRef | null>();
      return hook();
    } catch {
      return null;
    }
  }, []);

  const effectiveTreeId = useMemo<TreeId>(() => (
    treeId ?? ((parentId ?? nodeId ?? '') as TreeId)
  ), [nodeId, parentId, treeId]);

  const {
    draft: rawDraft,
    updateDraft,
    saveDraft,
    discardDraft,
  } = useTreeNodeUpdater<LocationEntity>({
    mode,
    nodeType: 'location',
    nodeId,
    parentId,
    treeId: effectiveTreeId,
    workerClient,
  });

  useEffect(() => () => { void discardDraft().catch(() => {}); }, [discardDraft]);

  const dialogSizeRef = useRef<MultiStepDialogSize>(dialogViewState.size);
  const dialogPositionRef = useRef<MultiStepDialogPosition>(dialogViewState.position);
  const vectorServiceRef = useRef<LocationVectorTileService | null>(null);
  const { size: dialogSize, position: dialogPosition, displayMode, activeStepIndex } = dialogViewState;
  const [isBatchStarting, setIsBatchStarting] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);

  const dialogData = useMemo<LocationDraft>(() => normalizeLocationDraft(rawDraft), [rawDraft]);
  const emptyTableMetadata = useMemo<TabularTableMetadata>(() => ({
    id: dialogData.tabularSourceId ?? 'temp-table',
    filename: dialogData.tabularSourceId ?? 'temp',
    contentHash: '',
    fileSizeBytes: 0,
    totalRows: 0,
    columns: [],
    createdAt: Date.now(),
    referenceCount: 0,
    referencingPlugins: [],
  }), [dialogData.tabularSourceId]);

  const applyNormalizedState = useCallback((size: MultiStepDialogSize, position: MultiStepDialogPosition) => {
    dialogSizeRef.current = size;
    dialogPositionRef.current = position;
    updateDialogViewState({ size, position });
  }, [updateDialogViewState]);

  const { updatePayload, updateMetadata } = useMemo(
    () => createTreeNodeUpdaterActions<LocationEntity>(updateDraft),
    [updateDraft],
  );

  const handleDraftPatch = useCallback((patch: Partial<LocationDraft>) => {
    const merged = mergeLocationDraft(dialogData, patch);
    const payload = toDraftDataPayload(merged);
    updatePayload(payload.draftData ?? {}, dialogData.draft as LocationEntity | undefined);
    updateMetadata(
      {
        name: dialogData.name ?? '',
        description: dialogData.description ?? '',
        tags: dialogData.tags ?? [],
      },
      { name: '', description: '', tags: [] },
    );
  }, [dialogData, updateMetadata, updatePayload]);

  const ensureVectorTileService = useCallback((): LocationVectorTileService => {
    if (!vectorServiceRef.current) {
      vectorServiceRef.current = new LocationVectorTileService();
    }
    return vectorServiceRef.current;
  }, []);

  const handleStartBatch = useCallback(async () => {
    if (isBatchStarting) return;
    const nodeId = dialogData.treeNodeId;
    if (!nodeId) {
      notify.error('Save changes before starting a batch session.');
      return;
    }
    setIsBatchStarting(true);
    try {
      const pointsRaw = await listLocationPoints(nodeId);
      if (!pointsRaw.length) {
        notify.info('No location points available to process.');
        return;
      }

      const points = pointsRaw.map((point) => ({
        lon: point.longitude,
        lat: point.latitude,
        id: point.pid,
        properties: {
          name: point.name,
          kind: point.kind,
          gid0: point.gid0,
          gid1: point.gid1,
          gid2: point.gid2,
          ...(point.payload ?? {}),
        },
      }));

      const requestedMinZoom = Number(dialogData.draft?.tilesMinZoom ?? DEFAULT_MIN_ZOOM) || DEFAULT_MIN_ZOOM;
      const requestedMaxZoom = Number(dialogData.draft?.tilesMaxZoom ?? DEFAULT_MAX_ZOOM) || DEFAULT_MAX_ZOOM;
      const zoomMin = Math.max(0, Math.min(requestedMinZoom, requestedMaxZoom));
      const zoomMax = Math.max(zoomMin, requestedMaxZoom);

      const settings = {
        zoomMinGenerate: zoomMin,
        zoomMaxGenerate: zoomMax,
        zoomMaxServe: dialogData.draft?.tilesMaxZoom ?? zoomMax,
      } as const;

      const rawConcurrency = Number(dialogData.draft?.concurrentDownloads ?? DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY;
      const concurrency = Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, rawConcurrency));

      const service = ensureVectorTileService();
      const summary = await service.startSession(nodeId, points, settings, { concurrency });
      notify.success(`Batch session ${summary.sessionId} started.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(`Failed to start batch session: ${message}`);
    } finally {
      setIsBatchStarting(false);
    }
  }, [dialogData, ensureVectorTileService, isBatchStarting]);

  const stepComponents = useMemo<ReadonlyArray<StepComponentDescriptor<LocationDraft>>>(() => ([
    {
      id: 'basic-info',
      label: translations.basicInfo.title,
      component: ({ data, onChange }: { data: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void }) => (
        <SharedBasicInfoStep
          name={data.draft?.name ?? ''}
          description={data.draft?.description ?? ''}
          tags={data.tags ?? []}
          mode={mode}
          tagSuggestions={translations.basicInfo.tagSuggestions ?? []}
          validate={({ name }) => (name.trim().length ? null : translations.errors.nameRequired)}
          onChange={(value: BasicInfoData) => {
            onChange({
              draft: {
                ...data.draft,
                name: value.name,
                description: value.description,
              },
              tags: value.tags,
            });
          }}
        />
      ),
    },
    {
      id: 'data-source',
      label: translations.dialog.dataSourceLabel,
      component: ({ onChange }: { data: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void }) => (
        <TabularProvider tabularApi={createLocationTabularApi()}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle1">{translations.dialog.dataSourceLabel}</Typography>
              <Typography variant="caption" color="text.secondary">
                {translations.dialog.dataSourceDescription ?? 'Choose openstreetmap for OSRM/Overpass or custom for tabular import'}
              </Typography>
            </Box>
            <TabularDataImport
              pluginId="location"
              onFileImported={(meta: TabularTableMetadata) =>
                onChange({ tabularSourceId: meta.id, dataSource: 'custom' as any })
              }
              onError={(msg: string) => notify.error(msg)}
            />
          </Box>
        </TabularProvider>
      ),
    },
    {
      id: 'selection',
      label: translations.selection.title,
      component: ({ data, onChange }: { data: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void }) => (
        <LocationSelectionStep draft={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'batch-parameters',
      label: translations.panel.processingSettings,
      component: ({ data, onChange }: { data: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void }) => (
        <LocationBatchParametersStep draft={data} onUpdate={onChange} />
      ),
    },
    {
      id: 'extract',
      label: translations.selection?.filterTitle ?? translations.selection.title ?? 'Filter & Preview',
      component: ({ data, onChange }: { data: LocationDraft; onChange: (patch: Partial<LocationDraft>) => void }) => (
        <TabularProvider tabularApi={createLocationTabularApi()}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TabularDataFilter
              tableMetadata={emptyTableMetadata}
              pluginId="location"
              onFiltersChanged={(filters: TabularFilterRule[]) =>
                onChange({
                  extractConfig: {
                    ...(data.extractConfig ?? {}),
                    filterRules: filters,
                    selection: data.extractConfig?.selection,
                  },
                })
              }
              onPreviewData={() => {}}
            />
            <TabularColumnSelect
              tableMetadata={emptyTableMetadata}
              onSelectionChanged={(selection: TabularColumnMapping[]) => {
                const mapped: TabularSelectionConfig = {
                  keyColumn: selection.find((m) => m.included)?.targetColumn,
                  valueColumns: selection.filter((m) => m.included).map((m) => m.targetColumn),
                  filterRules: data.extractConfig?.filterRules ?? [],
                  customMappings: selection.map((m) => ({
                    key: m.sourceColumn,
                    value: m.targetColumn,
                    label: m.targetColumn,
                  })),
                };
                onChange({
                  extractConfig: {
                    ...(data.extractConfig ?? {}),
                    selection: mapped,
                  },
                });
              }}
            />
            <Button
              variant="contained"
              onClick={async () => {
                if (!data.tabularSourceId) {
                  notify.error('No tabular source to build. Download/Upload first.');
                  return;
                }
                setIsBatchStarting(true);
                setBuildStatus('extracting');
                try {
                  const filters = data.extractConfig?.filterRules ?? [];
                  const selection = data.extractConfig?.selection;
                  const tabularApi = createLocationTabularApi();
                  await runLocationTabularBuild(
                    tabularApi as any,
                    data.tabularSourceId as string,
                    filters,
                    selection,
                    nodeId as NodeId,
                    (progress) => {
                      setBuildStatus(`${progress.stage ?? 'building'} ${progress.completed ?? 0}/${progress.total ?? ''}`);
                    }
                  );
                  notify.success('Build completed');
                } catch (err) {
                  notify.error(`Build failed: ${(err as Error).message}`);
                  setBuildStatus(null);
                } finally {
                  setIsBatchStarting(false);
                  setBuildStatus(null);
                }
              }}
            >
              {translations.selection?.buildLabel ?? 'Build'}
            </Button>
            {buildStatus ? (
              <Typography variant="caption" color="text.secondary">{buildStatus}</Typography>
            ) : null}
          </Box>
        </TabularProvider>
      ),
    },
    {
      id: 'map-preview',
      label: translations.mapPreview?.title ?? 'Map Preview',
      component: ({ data }: { data: LocationDraft }) => (
        <LocationMapPreviewStep draft={data} />
      ),
    },
  ]), [translations.basicInfo.title, translations.basicInfo.tagSuggestions, translations.dialog.dataSourceLabel, translations.dialog.licenseAgreementLabel, translations.dialog.dataSourceDescription, translations.selection.title, translations.selection?.filterTitle, translations.selection?.buildLabel, translations.panel.processingSettings, translations.mapPreview?.title, translations.errors.nameRequired, mode, emptyTableMetadata, buildStatus, nodeId]);

  const enabledStepIndices = useMemo(() => stepComponents.map((_, index) => index), [stepComponents]);
  const committableStepIndices = useMemo(() => [stepComponents.length - 1], [stepComponents.length]);

  const canStartBatch = Boolean(dialogData.treeNodeId && dialogData.draft?.licenseAgreement && dialogData.draft?.dataSource);

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    if (mode === 'full-screen') {
      const size: MultiStepDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      applyNormalizedState(size, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const preset = getPresetSize('maximize', viewport);
      const normalized = normalizeDialogState(preset, {
        x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      }, viewport, {
        enforceTopLeftMargin: false,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const preset = getPresetSize('normal', viewport);
      const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
        enforceTopLeftMargin: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    }

    updateDialogViewState({ displayMode: mode });
  }, [applyNormalizedState, updateDialogViewState]);

  const handleSave = useCallback(async () => {
    try {
      await saveDraft(toDraftDataPayload(dialogData));
      onSuccess?.(dialogData);
      notify.success('Location saved successfully');
    } catch (e) {
      onError?.(e as Error);
      notify.error('Failed to save location');
    } finally {
      onClose();
    }
  }, [dialogData, onClose, onError, onSuccess, saveDraft]);

  const handleCancel = useCallback(async () => {
    await discardDraft().catch(() => {});
    notify.info('Location changes discarded');
    onClose();
  }, [discardDraft, onClose]);

  const handleSizeChange = useCallback((next?: MultiStepDialogSize) => {
    if (!next) return;
    const normalized = normalizeDialogState(next, dialogPositionRef.current, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handlePositionChange = useCallback((next?: MultiStepDialogPosition) => {
    if (!next) return;
    const normalized = normalizeDialogState(dialogSizeRef.current, next, getViewportSize(), {
      enforceTopLeftMargin: displayMode === 'normal',
      minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      clampSizeToViewport: true,
    });
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const handleStepNavigate = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        updateDialogViewState({ activeStepIndex: event.targetIndex });
        break;
      case 'next':
        updateDialogViewState({
          activeStepIndex: Math.min(activeStepIndex + 1, stepComponents.length - 1),
        });
        break;
      case 'back':
        updateDialogViewState({
          activeStepIndex: Math.max(activeStepIndex - 1, 0),
        });
        break;
      default:
        break;
    }
  }, [activeStepIndex, stepComponents.length, updateDialogViewState]);

  const renderHeader: HeadlessDialogProps<LocationDraft>['renderHeader'] = useCallback((propsHeader: HeadlessHeaderRenderProps<LocationDraft>) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: '1px solid #dde1eb' }}>
      <Box display="flex" alignItems="center" gap={1.5}>
        <LocationOn color="primary" />
        <Box>
          <Typography variant="h6" component="div">
            {mode === 'create' ? translations.dialog.createTitle : translations.dialog.editTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {translations.dialog.datasetDescription}
          </Typography>
        </Box>
      </Box>
      <Button size="small" onClick={() => propsHeader.stepNavigation({ type: 'back' })} disabled={propsHeader.activeStepIndex === 0}>
        Back
      </Button>
    </Box>
  ), [mode, translations.dialog.createTitle, translations.dialog.datasetDescription, translations.dialog.editTitle]);

  const renderFooter: HeadlessDialogProps<LocationDraft>['renderFooter'] = useCallback((propsFooter: HeadlessFooterRenderProps<LocationDraft>) => {
    const canCommit = propsFooter.committableStepIndices.includes(propsFooter.activeStepIndex);
    const startBatchLabel = 'Start Batch';

    return (
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderTop: '1px solid #dde1eb' }}>
        <Box display="flex" gap={1}>
          <Button size="small" onClick={() => transitionDisplayMode('normal')} disabled={displayMode === 'normal'}>
            {translations.dialog.displayNormal}
          </Button>
          <Button size="small" onClick={() => transitionDisplayMode('maximize')} disabled={displayMode === 'maximize'}>
            {translations.dialog.displayMaximize}
          </Button>
          <Button size="small" onClick={() => transitionDisplayMode('full-screen')} disabled={displayMode === 'full-screen'}>
            {translations.dialog.displayFullscreen}
          </Button>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => propsFooter.onRequestClose('close')}>
            {translations.dialog.cancel}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            disabled={!canStartBatch || isBatchStarting}
            onClick={() => {
              void handleStartBatch();
            }}
          >
            {isBatchStarting ? 'Starting…' : startBatchLabel}
          </Button>
          <Button
            variant="contained"
            onClick={() => propsFooter.onRequestCommit?.()}
            disabled={!canCommit}
          >
            {translations.dialog.save}
          </Button>
        </Box>
      </Box>
    );
  }, [
    canStartBatch,
    displayMode,
    handleStartBatch,
    isBatchStarting,
    transitionDisplayMode,
    translations.dialog.cancel,
    translations.dialog.displayFullscreen,
    translations.dialog.displayMaximize,
    translations.dialog.displayNormal,
    translations.dialog.save,
  ]);

  const dialogProps: HeadlessDialogProps<LocationDraft> = {
    open,
    stepComponents,
    stepData: dialogData,
    onStepDataChange: handleDraftPatch,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices: [],
    committableStepIndices,
    invalidMessageMap: {},
    isDirty: true,
    onStepNavigate: handleStepNavigate,
    onRequestClose: () => { void handleCancel(); },
    onRequestCommit: () => { void handleSave(); },
    renderHeader,
    renderFooter,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    displayMode,
    onDisplayModeChange: transitionDisplayMode,
  };

  return (
    <HeadlessMultiStepDialog<LocationDraft> {...dialogProps} />
  );
};
