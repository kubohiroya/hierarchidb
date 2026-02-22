import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import type {
  ShapeEntity,
  SelectedArrayByCountries,
} from '~/common/types/ShapeEntity';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  summarizeCheckboxState,
  validateBuildConfig,
} from '~/common/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import { ShapeDataSourceStep } from './data-source/ShapeDataSourceStep.tsx';
import { ShapePreviewStep } from './preview/ShapePreviewStep.tsx';
import { useTranslation as getTranslation } from '~/ui/i18n';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.js';
import { ShapeBuildConfigStep } from './build-config/ShapeBuildConfigStep.tsx';
import { ShapeCountrySelectionStep } from './country-selection/ShapeCountrySelectionStep.tsx';
import { ShapeBuildStep } from './build-progress/ShapeBuildStep/ShapeBuildStep.tsx';

const registry = PluginStepRegistry.getInstance();

type ShapeStepProps = PluginStepProps<Partial<ShapeEntity>>;

const isSameShapeData = (
  left?: Partial<ShapeEntity> | null,
  right?: Partial<ShapeEntity> | null,
): boolean => {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

function createStepAdapter(
  Component: React.ComponentType<ShapeDialogStepProps>,
): (props: ShapeStepProps) => ReactElement {
  return function ShapeStepAdapter(props: ShapeStepProps) {
    const latestDataRef = useRef<Partial<ShapeEntity> | undefined>(undefined);
    useEffect(() => {
      latestDataRef.current = {
        ...(latestDataRef.current ?? {}),
        ...(props.data ?? {}),
      };
    }, [props.data]);
    const data = ({
      ...(props.data ?? {}),
    }) as Partial<ShapeEntity>;
    const handleChange = useCallback((updates: Partial<ShapeEntity>) => {
      const next = {
        ...(latestDataRef.current ?? {}),
        ...updates,
      } as Partial<ShapeEntity>;
      if (isSameShapeData(next, latestDataRef.current)) {
        return;
      }
      latestDataRef.current = next;
      props.onChange(next);
    }, [props.onChange]);

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
  const processingValid = validateBuildConfig(
    data.buildConfig,
    data.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
  ).isValid;
  return hasSelection && hasDataSource && processingValid;
};

const isShapeBuildPersisted = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing') return true;
  if (data.processingStatus === 'completed') return true;
  if (typeof data.buildFinishedAt === 'number') return true;
  if (data.processingStatus === 'failed') return true;
  return canStartShapeBuild(data);
};

const isShapePreviewReady = async (data?: Partial<ShapeEntity>): Promise<boolean> => {
  if (!data) return false;
  if (data.processingStatus === 'processing') return true;
  if (typeof data.buildFinishedAt === 'number') return true;
  if (data.processingStatus === 'completed') return true;
  return canStartShapeBuild(data);
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
          Boolean(data?.buildConfig?.dataSourceName),
      },
      {
        id: 'processing-configuration',
        label: t('steps.processing.label', 'Config'),
        componentFactory: (props: ShapeStepProps) => <ShapeProcessing {...props} />,
        validate: (data?: Partial<ShapeEntity>) =>
          validateBuildConfig(
            data?.buildConfig ?? DEFAULT_BUILD_CONFIG,
            data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
          ).isValid,
      },
      {
        id: 'build',
        label: t('steps.stage.label', 'Build'),
        componentFactory: (props: ShapeStepProps) => <ShapeBuildProgress {...props} />,
        validate: (data?: Partial<ShapeEntity>) => isShapeBuildPersisted(data),
        capabilities: {
          canStartBuild: (data?: Partial<ShapeEntity>) => canStartShapeBuild(data),
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
