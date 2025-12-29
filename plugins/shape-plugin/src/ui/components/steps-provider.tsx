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
import { shapeDB } from '../../services/database/ShapeDB.js';
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
      latestDataRef.current = props.data ?? null;
    }, [props.data]);
    const data = (props.data ?? {}) as Partial<ShapeEntity>;
    const handleChange = (updates: Partial<ShapeEntity>) => {
      const next = {
        ...(latestDataRef.current ?? {}),
        ...updates,
      } as ShapeEntity;
      latestDataRef.current = next;
      props.onChange(next);
    };

    return (
      <Component
        nodeId={props.nodeId}
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

const hasPersistedVectorTiles = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeKey = resolveShapeNodeKey(data);
  if (!nodeKey) return false;
  const count = await shapeDB.vectorTiles.where('nodeId').equals(nodeKey).count();
  return count > 0;
};

const hasCompletedBatchSession = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  const nodeId = data?.nodeId;
  if (!nodeId) return false;
  const session = await shapeDB.batchSessions.get(String(nodeId));
  return session?.status === 'completed';
};

const isShapeBuildPersisted = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (await hasPersistedVectorTiles(data)) return true;
  return hasCompletedBatchSession(data);
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
        label: t('steps.build.label', 'Build'),
        componentFactory: (props: ShapeStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
        capabilities: {
          canStartBatch: (data?: Partial<ShapeEntity>) => canStartShapeBatch(data),
        },
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        componentFactory: (props: ShapeStepProps) => <ShapePreview {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId, _data) {
    return this.getCreateStepConfigs();
  },
});

export {}; // ensure module side-effects run on import
