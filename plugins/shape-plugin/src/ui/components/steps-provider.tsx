import type React from 'react';
import { useEffect, useRef } from 'react';
import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import type {
  ShapeEntity,
  SelectedArrayByCountries,
} from '../../common/types/ShapeEntity.ts';
import { summarizeCheckboxState, validateBatchConfig } from '../../common/types/index.js';
import { type NodeId, toNodeId } from '@hierarchidb/common-types';
import { ShapeDataSourceStep } from './step2/ShapeDataSourceStep.tsx';
import { ShapePreviewStep } from './step6/ShapePreviewStep.tsx';
import { useTranslation as getTranslation } from '../../ui/i18n.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.js';
import { ShapeBuildConfigStep } from './step4/ShapeBuildConfigStep.tsx';
import { ShapeCountrySelectionStep } from './step3/ShapeCountrySelectionStep.tsx';
import { ShapeBuildStep } from './step5/ShapeBuildStep.tsx';
import { shapeQueryAPIImpl } from '../../services/batch/ShapeBuildAPIClient.ts';

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
    }, [props.data, props.nodeId]);
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
const ShapeProcessing = createStepAdapter(ShapeBuildConfigStep);
const ShapeCountrySelection = createStepAdapter(ShapeCountrySelectionStep);
const ShapePreview = createStepAdapter(ShapePreviewStep);
const ShapeBuildProgress = createStepAdapter(ShapeBuildStep);

const resolveSelectedArrayByCountries = (data?: Partial<ShapeEntity>): SelectedArrayByCountries | undefined =>
  data?.selectedArrayByCountries;

const canStartShapeBuild = (data?: Partial<ShapeEntity>): boolean => {
  // data reflects draftData (payload) only
  const hasSelection = summarizeCheckboxState(resolveSelectedArrayByCountries(data)).hasSelection;
  const hasDataSource = Boolean(data?.buildConfig?.dataSourceName);
  if (!data?.buildConfig) return false;
  const processingValid = validateBatchConfig(data.buildConfig).isValid;
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
  const summary = await shapeQueryAPIImpl.getVectorTileSummary(nodeId);
  return summary.tiles > 0;
};

const hasPersistedMetadata = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const rows = await shapeQueryAPIImpl.listSourceMetadata(nodeId);
  return rows.length > 0;
};

const hasPersistedTransformErrors = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = requireShapeNodeId(data);
  const rows = await shapeQueryAPIImpl.listTransformErrorRecords(nodeId);
  return rows.length > 0;
};

const isShapeBuildPersisted = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing') return true;
  if (data.processingStatus === 'completed') return true;
  if (data.processingStatus === 'failed') return hasPersistedTransformErrors(data);
  if (hasTileSummary(data)) return true;
  if (await hasPersistedVectorTiles(data)) return true;
  return hasPersistedTransformErrors(data);
};

const isShapePreviewReady = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing') return true;
  if (await hasPersistedMetadata(data)) return true;
  if (await hasPersistedTransformErrors(data)) return true;
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
          Boolean(data?.buildConfig?.dataSourceName),
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
          Boolean(data?.buildConfig && validateBatchConfig(data.buildConfig).isValid),
      },
      {
        id: 'build',
        label: t('steps.stage.label', 'Build'),
        componentFactory: (props: ShapeStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
        capabilities: {
          canStartBatch: (data?: Partial<ShapeEntity>) => canStartShapeBuild(data),
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
