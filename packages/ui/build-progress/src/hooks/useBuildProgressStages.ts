import { createElement, useMemo, type ReactNode } from 'react';
import { CloudDownload, Layers, Tune } from '@mui/icons-material';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildSessionProgressPanelProps } from '@hierarchidb/components';

type BuildStageId = 'fetch' | 'transform' | 'vt';

type Translate = (key: string, fallback?: string) => string;

type BuildStageOverride = {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export type ResolveBuildStagesOptions = {
  t: Translate;
  includeDescriptions?: boolean;
  overrides?: Partial<Record<BuildStageId, BuildStageOverride>>;
};

type SplitViewInitialSizes = [number[], number[], number[], number[]];

const DEFAULT_STAGE_ORDER: BuildStageId[] = ['fetch', 'transform', 'vt'];

export type BuildSessionProgressPanelSplitViewLayoutProps = Pick<
  BuildSessionProgressPanelProps,
  'splitViewBreakpoints' | 'splitViewInitialSizesByBreakpoint' | 'splitViewAutoCloseCountsByBreakpoint'
>;

export const resolveBuildStages = ({
  t,
  includeDescriptions = false,
  overrides = {},
}: ResolveBuildStagesOptions): BuildStage[] => {
  return DEFAULT_STAGE_ORDER.map((id) => {
    const label = overrides[id]?.title ?? t(`processing.${id}.title`, fallbackLabelById(id));
    const description = includeDescriptions
      ? overrides[id]?.description ?? t(`processing.${id}.description`, fallbackDescriptionById(id))
      : undefined;
    const icon = overrides[id]?.icon
      ?? (id === 'fetch'
        ? createElement(CloudDownload, { color: 'primary' })
        : id === 'transform'
          ? createElement(Tune, { color: 'primary' })
          : createElement(Layers, { color: 'primary' }));

    return {
      id,
      title: label,
      description,
      icon,
    } satisfies BuildStage;
  });
};

const fallbackLabelById = (id: BuildStageId): string => {
  switch (id) {
    case 'fetch':
      return 'Fetch';
    case 'transform':
      return 'Transform';
    case 'vt':
      return 'Vector Tiles';
    default:
      return 'Build';
  }
};

const fallbackDescriptionById = (id: BuildStageId): string => {
  switch (id) {
    case 'fetch':
      return 'Download and prepare data.';
    case 'transform':
      return 'Transform and normalize prepared data.';
    case 'vt':
      return 'Generate output artifacts.';
    default:
      return '';
  }
};

export const useBuildProgressStages = ({
  t,
  includeDescriptions = false,
  overrides = {},
}: ResolveBuildStagesOptions): BuildStage[] => {
  return useMemo(() => resolveBuildStages({
    t,
    includeDescriptions,
    overrides,
  }), [t, includeDescriptions, overrides]);
};

export const resolveSplitViewAutoCloseCounts = (stageCount: number): [number, number, number, number] => [
  Math.max(0, stageCount - 1),
  Math.max(0, stageCount - 2),
  Math.max(0, stageCount - 3),
  0,
];

export const resolveSplitViewInitialSizes = (stageCount: number, panelSize = 300): SplitViewInitialSizes => {
  const size = Array.from({ length: stageCount }, () => panelSize);
  return [
    [...size],
    [...size],
    [...size],
    [...size],
  ];
};

export const SPLITVIEW_BREAKPOINTS: number[] = [600, 900, 1200];

export type BuildSessionProgressPanelViewModel = Omit<
  BuildSessionProgressPanelProps,
  'splitViewBreakpoints' | 'splitViewInitialSizesByBreakpoint' | 'splitViewAutoCloseCountsByBreakpoint'
>;

export const resolveBuildSessionProgressPanelSplitViewProps = (
  params: {
    stagesLength: number;
    splitViewPanelSize?: number;
  },
): BuildSessionProgressPanelSplitViewLayoutProps => ({
  splitViewBreakpoints: SPLITVIEW_BREAKPOINTS,
  splitViewInitialSizesByBreakpoint: resolveSplitViewInitialSizes(params.stagesLength, params.splitViewPanelSize),
  splitViewAutoCloseCountsByBreakpoint: resolveSplitViewAutoCloseCounts(params.stagesLength),
});
