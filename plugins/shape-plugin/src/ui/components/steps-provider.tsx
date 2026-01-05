import type React from 'react';
import { useEffect, useRef } from 'react';
import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import {
  summarizeCheckboxState,
  validateBatchConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeBatchConfig,
  type ShapeEntity,
  type SelectedArrayByCountries,
} from '../../common/types/index.js';
import { NodeId, toNodeId } from '@hierarchidb/common-types';
import { getShapeDbApiClient } from '../../services/batch/ShapeBatchApiClient.js';
import { ShapeDataSourceStep } from './steps/ShapeDataSourceStep.js';
import { ShapeProcessingSettingsStep } from './steps/ShapeProcessingSettingsStep.js';
import { ShapeCountrySelectionStep } from './steps/ShapeCountrySelectionStep.js';
import { ShapePreviewStep } from './steps/ShapePreviewStep.js';
import { ShapeBuildProgressStep } from './steps/ShapeBuildProgressStep.js';
import { useTranslation as getTranslation } from '../../ui/i18n.js';
import type { ShapeDialogStepProps } from './steps/ShapeDialogStepProps.js';


const registry = PluginStepRegistry.getInstance();

type ShapeStepProps = PluginStepProps<ShapeEntity>;

function createStepAdapter(
  Component: React.ComponentType<ShapeDialogStepProps>,
): (props: ShapeStepProps) => JSX.Element {
  return function ShapeStepAdapter(props: ShapeStepProps) {
    const latestDataRef = useRef<ShapeEntity | null>(null);
    useEffect(() => {
      latestDataRef.current = {
        nodeId: props.nodeId as NodeId,
        ...(props.data ?? {}),
      };
    }, [props.data]);
    const data = ({
      nodeId: props.nodeId as NodeId,
      ...(props.data ?? {}),
    }) as Partial<ShapeEntity>;
    const handleChange = (updates: Partial<ShapeEntity>) => {
      const next = {
        ...(latestDataRef.current ?? {}),
        nodeId: props.nodeId as NodeId,
        ...updates,
      } as ShapeEntity;
      latestDataRef.current = next;
      props.onChange(next);
    };

    return (
      <Component
        nodeId={props.nodeId as NodeId}
        data={data}
        onChange={handleChange}
        disabled={Boolean(props.disabled)}
      />
    );
  };
}

const ShapeDataSource = createStepAdapter(ShapeDataSourceStep);
const ShapeProcessing = createStepAdapter(ShapeProcessingSettingsStep);
const ShapeCountrySelection = createStepAdapter(ShapeCountrySelectionStep);
const ShapePreview = createStepAdapter(ShapePreviewStep);
const ShapeBuildProgress = createStepAdapter(ShapeBuildProgressStep);

const resolveSelectedArrayByCountries = (data?: Partial<ShapeEntity>): SelectedArrayByCountries | undefined =>
  data?.selectedArrayByCountries;

const canStartShapeBatch = (data?: Partial<ShapeEntity>): boolean => {
  // data reflects draftData (payload) only
  const hasSelection = summarizeCheckboxState(resolveSelectedArrayByCountries(data)).hasSelection;
  const hasDataSource = Boolean(data?.batchConfig?.dataSource);
  const processingValid = validateBatchConfig(
    mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
  ).isValid;
  return hasSelection && hasDataSource && processingValid;
};

const resolveShapeNodeKey = (data?: Partial<ShapeEntity>): string | null => {
  const key = data?.nodeId;
  return key ? String(key) : null;
};

const requireShapeNodeId = (data?: Partial<ShapeEntity>): NodeId => {
  const nodeKey = resolveShapeNodeKey(data);
  if (!nodeKey) {
    throw new Error('Shape nodeId is required for preview readiness checks.');
  }
  return toNodeId(nodeKey);
};

const hasTileSummary = (data?: Partial<ShapeEntity>): boolean =>
  Boolean(data?.tileSummary && (data.tileSummary.tiles ?? 0) > 0);

const hasPersistedVectorTiles = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const summary = await getShapeDbApiClient().query.getVectorTileSummary(nodeId);
  return summary.tiles > 0;
};

const hasPersistedMetadata = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const rows = await getShapeDbApiClient().query.listSourceMetadata(nodeId);
  return rows.length > 0;
};

const hasCompletedVectorTileTasks = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const tasks = await getShapeDbApiClient().ephemeral.listBatchTasksByType(nodeId, 'vectortile');
  if (tasks.length === 0) return false;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  return completed === tasks.length;
};

const hasCompletedBatchSession = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const session = await getShapeDbApiClient().query.getBatchSessionRecord(nodeId);
  return session?.status === 'completed';
};

const isShapeBuildPersisted = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing' || data.processingStatus === 'paused') return true;
  if (data.processingStatus === 'completed') return true;
  if (data.processingStatus === 'failed') return false;
  if (hasTileSummary(data)) return true;
  if (await hasPersistedVectorTiles(data)) return true;
  if (await hasCompletedVectorTileTasks(data)) return true;
  return hasCompletedBatchSession(data);
};

const isShapePreviewReady = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing' || data.processingStatus === 'paused') return true;
  if (await hasPersistedMetadata(data)) return true;
  if (hasTileSummary(data)) return true;
  return hasPersistedVectorTiles(data);
};

registry.registerConfigProvider<Partial<ShapeEntity>>({
  nodeType: 'shape',
  getCreateStepConfigs() {
    const { t } = getTranslation();
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (props: ShapeStepProps) => <ShapeDataSource {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          Boolean(data?.batchConfig?.dataSource),
      },
      {
        id: 'country-selection',
        label: t('steps.countrySelection.label', 'Country Selection'),
        componentFactory: (props: ShapeStepProps) => <ShapeCountrySelection {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          summarizeCheckboxState(resolveSelectedArrayByCountries(data)).hasSelection,
      },
      {
        id: 'processing-configuration',
        label: t('steps.processing.label', 'Processing Configuration'),
        componentFactory: (props: ShapeStepProps) => <ShapeProcessing {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          validateBatchConfig(
            mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
          ).isValid,
      },
      {
        id: 'build',
        label: t('steps.stage.label', 'Build'),
        componentFactory: (props: ShapeStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
        capabilities: {
          canStartBatch: (data?: Partial<ShapeEntity>) => canStartShapeBatch(data),
          canProceedToNext: (data?: Partial<ShapeEntity>) => isShapePreviewReady(data),
          canSave: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
        },
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (props: ShapeStepProps) => <ShapePreview {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapePreviewReady(data),
        capabilities: {
          canNavigateTo: (_fromStep: number, data?: Partial<ShapeEntity>) => isShapePreviewReady(data),
        },
      },
    ];
  },
  getEditStepConfigs(_nodeId, _data) {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
