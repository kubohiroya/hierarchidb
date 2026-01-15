import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuildStage } from '@hierarchidb/components';
import type { CrashInsight } from '@hierarchidb/ui-monitoring';
import type { ShapeEntity } from '../../../common/types/index.js';
import { getStageConcurrencyWarning, type ShapeBuildConfigSnapshot, type ShapeBuildStage } from '../../utils/buildWarnings.js';

type StartWarning = {
  title: string;
  message: string;
};

type Params = {
  crashInsight: CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null;
  data?: Partial<ShapeEntity>;
  stages: BuildStage[];
  warningMessage?: string | null;
  isDev: boolean;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
};

export const useShapeBuildProgressWarnings = ({
  crashInsight,
  data,
  stages,
  warningMessage,
  isDev,
  t,
}: Params) => {
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [crashHintOpen, setCrashHintOpen] = useState(false);
  const [sizeWarningOpen, setSizeWarningOpen] = useState(false);
  const lastWarningRef = useRef<string | null>(null);

  const startWarning = useMemo<StartWarning | null>(() => {
    if (!crashInsight || !crashInsight.memoryPressure) return null;
    const stageId = crashInsight.stage;
    if (!stageId) {
      return {
        title: t('stage.warning.title', 'Build warning'),
        message: t(
          'stage.warning.unknownStage',
          'A previous stage ended without a completion record. Consider lowering concurrency if it happens again.',
        ),
      };
    }
    const stage = stages.find((candidate) => candidate.id === stageId);
    const stageLabel = stage?.title ?? stageId;
    const buildConfig = data?.buildConfig;
    if (!buildConfig) return null;
    const currentValue = (() => {
      switch (stageId) {
        case 'fetch':
          return buildConfig.fetchConfig.maxConcurrent;
        case 'transform-by-band':
          return buildConfig.transformByBandConfig.maxConcurrent;
        case 'transform-by-zoom':
          return buildConfig.transformByZoomConfig.maxConcurrent;
        case 'vt':
          return buildConfig.vtConfig.maxConcurrent;
        default:
          return undefined;
      }
    })();
    const warning = getStageConcurrencyWarning(crashInsight, stageId, currentValue);
    if (!warning) return null;
    const ratioText = crashInsight.peakRatio
      ? `${(crashInsight.peakRatio * 100).toFixed(1)}%`
      : t('stage.warning.memoryUnknown', 'unknown');
    return {
      title: t('stage.warning.title', 'Build warning'),
      message: t(
        'stage.warning.message',
        'The previous stage ended without completion. Peak memory usage for {{stage}} was {{ratio}}. Current concurrency is {{value}} (threshold {{threshold}}). Consider lowering it.',
        {
          stage: stageLabel,
          ratio: ratioText,
          value: currentValue ?? '-',
          threshold: warning.threshold ?? '-',
        },
      ),
    };
  }, [crashInsight, data?.buildConfig, stages, t]);

  const crashHint = useMemo(() => {
    if (isDev) return null;
    if (!crashInsight) return null;
    if (!crashInsight.memoryPressure) {
      return t(
        'stage.warning.genericHint',
        'A previous stage ended without a completion record. Consider reducing concurrency if it happens again.',
      );
    }
    const stageLabel = crashInsight.stage
      ? stages.find((candidate) => candidate.id === crashInsight.stage)?.title
        ?? crashInsight.stage
      : t('stage.warning.unknownStageShort', 'unknown stage');
    const ratioText = crashInsight.peakRatio
      ? `${(crashInsight.peakRatio * 100).toFixed(1)}%`
      : t('stage.warning.memoryUnknown', 'unknown');
    return t(
      'stage.warning.memoryHint',
      'Previous stage likely hit memory pressure during {{stage}} (peak {{ratio}}). Lower concurrency to reduce memory usage.',
      { stage: stageLabel, ratio: ratioText },
    );
  }, [crashInsight, isDev, stages, t]);

  useEffect(() => {
    if (crashHint) {
      setCrashHintOpen(true);
    } else {
      setCrashHintOpen(false);
    }
  }, [crashHint]);

  useEffect(() => {
    if (!warningMessage) {
      setSizeWarningOpen(false);
      lastWarningRef.current = null;
      return;
    }
    if (lastWarningRef.current === warningMessage) return;
    lastWarningRef.current = warningMessage;
    setSizeWarningOpen(true);
  }, [warningMessage]);

  return {
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
  };
};
