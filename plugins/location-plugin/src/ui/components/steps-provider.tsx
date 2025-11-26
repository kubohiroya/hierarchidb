import { PluginStepRegistry, type StartBatchContext, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { LocationDraft } from '../../common/types/index.js';
import { translations as locationTranslations } from '../../common/i18n/index.js';
import { LocationDataSourceStep } from '../../common/components/steps/LocationDataSourceStep.js';
import { LocationLicenseStep } from '../../common/components/steps/LocationLicenseStep.js';
import { LocationSelectionStep } from '../../common/components/steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from '../../common/components/steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from '../../common/components/steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';
import { notify } from '@hierarchidb/components';
import { listLocationPoints } from '../../services/pointRepository.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';

const registry = PluginStepRegistry.getInstance();

type LocationStepData = StepData & LocationDraft;

const ensureDraft = (data?: LocationDraft): LocationStepData => {
  if (data) {
    return {
      ...data,
      treeNodeId: data.treeNodeId ?? ('' as NodeId),
      draft: { ...(data.draft ?? {}) },
      createdAt: data.createdAt ?? (Date.now() as Timestamp),
      updatedAt: data.updatedAt ?? (Date.now() as Timestamp),
      tags: data.tags ?? [],
    } satisfies LocationDraft;
  }
  return {
    treeNodeId: '' as NodeId,
    draft: {},
    createdAt: Date.now() as Timestamp,
    updatedAt: Date.now() as Timestamp,
    tags: [],
  } satisfies LocationDraft;
};

const mergeDraft = (
  current: LocationDraft,
  updates: Partial<LocationDraft>
): LocationStepData => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
});

type StepProps = StepComponentProps<LocationStepData>;

const hasSelection = (data?: LocationDraft): boolean => {
  const matrix = data?.draft?.selectionMatrix;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;

const startLocationBatch = async (data: LocationStepData, context: StartBatchContext) => {
  const t = locationTranslations.en;
  const draft = data.draft ?? {};
  const nodeId = (context.nodeId ?? data.treeNodeId) as NodeId | undefined;

  if (!nodeId) {
    notify.error('Save changes before starting a build.');
    return;
  }

  if (!(draft.dataSource && draft.licenseAgreement)) {
    notify.info(
      t.build?.requiresApproval ??
        'Provide a data source, accept license terms, and save the node before building.'
    );
    return;
  }

  const pointsRaw = await listLocationPoints(nodeId);
  if (!pointsRaw.length) {
    notify.info(t.build?.noPoints ?? 'No location points available to process.');
    return;
  }

  const points = pointsRaw.map((point) => ({
    lon: Number(point.longitude) || 0,
    lat: Number(point.latitude) || 0,
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

  const settings = {
    zoomMinGenerate: clamp(Number((draft as Record<string, unknown>).tilesMinZoom ?? DEFAULT_MIN_ZOOM), 0, 24),
    zoomMaxGenerate: clamp(Number((draft as Record<string, unknown>).tilesMaxZoom ?? DEFAULT_MAX_ZOOM), 0, 24),
    zoomMaxServe: clamp(Number((draft as Record<string, unknown>).tilesMaxZoom ?? DEFAULT_MAX_ZOOM), 0, 24),
  } as const;

  const rawConcurrency = Number(draft.concurrentDownloads ?? 4);
  const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);

  const service = new LocationVectorTileService();
  const summary = await service.startSession(nodeId, points, settings, { concurrency });

  notify.success(
    t.build?.success?.replace?.('{sessionId}', summary.sessionId) ??
      `Build started (session ${summary.sessionId})`
  );
};

registry.registerConfigProvider<LocationDraft>({
  nodeType: 'location',
  getCreateStepConfigs() {
    const t = locationTranslations;
    return [
      {
        id: 'basic-info',
        label: t.en.basicInfo.title,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <SharedBasicInfoStep
              name={draft.draft?.name ?? ''}
              description={draft.draft?.description ?? ''}
              tags={draft.tags ?? []}
              mode={p.mode}
              tagSuggestions={t.en.basicInfo.tagSuggestions ?? []}
              validate={({ name }) => (name.trim().length ? null : t.en.errors.nameRequired)}
              onChange={(value: BasicInfoData) => {
                p.onChange(
                  mergeDraft(draft, {
                    draft: {
                      ...draft.draft,
                      name: value.name,
                      description: value.description,
                    },
                    tags: value.tags,
                  })
                );
              }}
            />
          );
        },
        validate: (data?: LocationDraft) => Boolean(data?.draft?.name?.trim()),
      },
      {
        id: 'data-source',
        label: t.en.dialog.dataSourceLabel,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <LocationDataSourceStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
            />
          );
        },
        validate: (data?: LocationDraft) => Boolean(data?.draft?.dataSource),
      },
      {
        id: 'license',
        label: t.en.dialog.licenseAgreementLabel,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <LocationLicenseStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
            />
          );
        },
        validate: (data?: LocationDraft) => Boolean(data?.draft?.licenseAgreement),
      },
      {
        id: 'selection',
        label: t.en.selection.title,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <LocationSelectionStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
            />
          );
        },
        validate: (data?: LocationDraft) => hasSelection(data),
      },
      {
        id: 'batch-parameters',
        label: t.en.panel.processingSettings,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <LocationBatchParametersStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'map-preview',
        label: t.en.mapPreview?.title ?? 'Map Preview',
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return <LocationMapPreviewStep draft={draft} />;
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t.en.build?.actionLabel ?? 'Build',
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <LocationBuildStep
              nodeId={p.nodeId as NodeId}
              draft={draft}
            />
          );
        },
        capabilities: {
          canStartBatch: (data: LocationDraft) =>
            Boolean(data?.treeNodeId && data?.draft?.dataSource && data?.draft?.licenseAgreement),
          startBatch: (data, context) => startLocationBatch(data, context),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
