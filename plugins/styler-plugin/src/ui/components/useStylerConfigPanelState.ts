import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ColorAlgorithm,
  ColorSpace,
  StylerConfig,
  StylerTableRow,
} from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { generateColorGradient } from '../../common/utils/colorUtils.js';
import {
  analyzeData,
  type DataAnalysisResult,
  extractNumericValues,
} from '../../common/utils/dataAnalysis.js';

type FormatFn = (key: string, defaultValue: string) => string;

export interface UseStylerConfigPanelStateParams {
  config?: StylerConfig;
  onChange: (config: StylerConfig) => void;
  values?: number[];
  selectedValueColumn?: string;
  tabularData?: StylerTableRow[];
  tStr: FormatFn;
}

export const useStylerConfigPanelState = ({
  config = StylerConfigDefault,
  onChange,
  values = [],
  selectedValueColumn,
  tabularData = [],
  tStr,
}: UseStylerConfigPanelStateParams) => {
  const [localConfig, setLocalConfig] = useState<StylerConfig>(() => {
    if (values.length > 0) {
      const numericValues = values.filter((v) => !Number.isNaN(v));

      if (numericValues.length > 0) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        return {
          ...config,
          min,
          max,
        };
      }
    }
    return config;
  });

  const [dataAnalysis, setDataAnalysis] = useState<DataAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const algorithmLabels = useMemo(
    () =>
      ({
        linear: tStr('step5.algorithms.linear', 'Linear'),
        log: tStr('step5.algorithms.log', 'Logarithmic'),
        quantile: tStr('step5.algorithms.quantile', 'Quantile'),
        jenks: tStr('step5.algorithms.jenks', 'Jenks Natural Breaks'),
        equal: tStr('step5.algorithms.equal', 'Equal Interval'),
      }) as Record<ColorAlgorithm, string>,
    [tStr]
  );

  const algorithmDescriptions = useMemo(
    () =>
      ({
        linear: tStr(
          'step5.algorithms.linearDescription',
          'Interpolates colors smoothly between minimum and maximum values. Ideal for evenly distributed data or when visualizing continuous transitions.'
        ),
        log: tStr(
          'step5.algorithms.logDescription',
          'Uses a logarithmic scale to emphasize smaller values while compressing large outliers. Suited for highly skewed distributions.'
        ),
        quantile: tStr(
          'step5.algorithms.quantileDescription',
          'Creates classes with an equal number of features. Produces balanced visuals even for skewed data and is resilient to outliers.'
        ),
        jenks: tStr(
          'step5.algorithms.jenksDescription',
          'Finds natural breaks by minimizing variance within classes and maximizing it between classes. Offers meaningful groupings at a higher computational cost.'
        ),
        equal: tStr(
          'step5.algorithms.equalDescription',
          'Divides the value range into equal intervals. Suited for continuous, roughly linear distributions such as temperature or elevation, and is fast and easy to understand.'
        ),
      }) as Record<ColorAlgorithm, string>,
    [tStr]
  );

  const recommendation = dataAnalysis?.recommendation || null;
  const recommendationTitle = recommendation
    ? tStr('step5.recommendation.summary', 'Recommended algorithm: {algorithm}').replace(
        '{algorithm}',
        algorithmLabels[recommendation.algorithm as ColorAlgorithm] || recommendation.algorithm
      )
    : '';
  const recommendationConfidence = recommendation
    ? tStr('step5.recommendation.confidence', 'Confidence: {confidence}%').replace(
        '{confidence}',
        String(Math.round(recommendation.confidence * 100))
      )
    : '';
  const currentSuitability =
    recommendation && recommendation.suitability
      ? recommendation.suitability[localConfig.algorithm] ?? null
      : null;

  useEffect(() => {
    if (selectedValueColumn && tabularData.length > 0) {
      setIsAnalyzing(true);

      const analyzeAsync = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));

          const numericValues = extractNumericValues(tabularData, selectedValueColumn);
          if (numericValues.length > 0) {
            const analysis = analyzeData(numericValues, selectedValueColumn);
            setDataAnalysis(analysis);
          }
        } finally {
          setIsAnalyzing(false);
        }
      };

      analyzeAsync();
    }
  }, [selectedValueColumn, tabularData]);

  const applyRecommendation = useCallback(() => {
    if (dataAnalysis?.recommendation) {
      const newConfig = {
        ...localConfig,
        algorithm: dataAnalysis.recommendation.algorithm,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
      setShowRecommendation(false);
    }
  }, [dataAnalysis, localConfig, onChange]);

  const handleAlgorithmChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newAlgorithm: ColorAlgorithm | null) => {
      if (!newAlgorithm) return;
      const newConfig = { ...localConfig, algorithm: newAlgorithm };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleColorSpaceChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newColorSpace: ColorSpace | null) => {
      if (!newColorSpace) return;
      const newConfig = { ...localConfig, colorSpace: newColorSpace };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleMappingChange = useCallback(
    (field: keyof StylerConfig) => (_event: Event, value: number | number[]) => {
      const newConfig = {
        ...localConfig,
        [field]: value as number,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleInvertColorsChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newValue: 'normal' | 'inverted') => {
      const inverted = newValue === 'inverted';
      const newConfig = { ...localConfig, invertColors: inverted };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleStartColorChange = useCallback(
    (hex: string) => {
      const newConfig = {
        ...localConfig,
        startColor: hex,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const handleEndColorChange = useCallback(
    (hex: string) => {
      const newConfig = {
        ...localConfig,
        endColor: hex,
      };
      setLocalConfig(newConfig);
      onChange(newConfig);
    },
    [localConfig, onChange]
  );

  const gradientPreview = useMemo(() => generateColorGradient(localConfig), [localConfig]);

  const stats = useMemo(() => {
    const numeric = values.filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
    if (!numeric.length) {
      return null;
    }
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const mean = numeric.reduce((sum, v) => sum + v, 0) / numeric.length;
    const variance = numeric.reduce((sum, v) => sum + (v - mean) ** 2, 0) / numeric.length;
    const stdDev = Math.sqrt(variance);
    return { min, max, mean, stdDev, count: numeric.length };
  }, [values]);

  return {
    localConfig,
    setLocalConfig,
    algorithmLabels,
    algorithmDescriptions,
    recommendation,
    recommendationTitle,
    recommendationConfidence,
    currentSuitability,
    isAnalyzing,
    dataAnalysis,
    showRecommendation,
    setShowRecommendation,
    showAdvanced,
    setShowAdvanced,
    applyRecommendation,
    handleAlgorithmChange,
    handleColorSpaceChange,
    handleMappingChange,
    handleInvertColorsChange,
    handleStartColorChange,
    handleEndColorChange,
    gradientPreview,
    stats,
  };
};
