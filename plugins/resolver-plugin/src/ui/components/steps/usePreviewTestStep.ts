import { useCallback, useEffect, useState } from 'react';
import type { MappingPreviewResult, MappingValidationResult, PropertyInfo, PropertyMappingRule, ResolverUpdaterPayload, SchemaInfo } from '~/common/entities/ResolverEntity';

interface UsePreviewTestStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
  onValidationResult: (result: MappingValidationResult | null) => void;
}

export function usePreviewTestStep({
  data,
  onValidationChange,
  onValidationResult,
  sourceSchema,
  targetSchema,
}: UsePreviewTestStepProps) {
  const draftData = data.draftData ?? {};
  const [isRunning, setIsRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<MappingPreviewResult | null>(null);
  const [validationResult, setValidationResult] = useState<MappingValidationResult | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);

  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  const runPreview = useCallback(async () => {
    if (!sourceSchema || !targetSchema || !draftData.mappingRules) {
      return;
    }

    setIsRunning(true);
    const startTime = performance.now();
    const startMemory = readHeapUsage();

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockResult: MappingPreviewResult = {
        success: true,
        mappedData:
          sourceSchema.sampleData
            ?.slice(0, 5)
            .map((sample: Record<string, unknown>, index: number) => {
              const mapped: Record<string, unknown> = {};
              draftData.mappingRules!.forEach((rule: PropertyMappingRule) => {
                if (sample && typeof sample === 'object' && rule.sourceProperty in sample) {
                  let value = (sample as Record<string, unknown>)[rule.sourceProperty];

                  if (rule.transformFunction) {
                    if (rule.transformFunction === 'lowercase' && typeof value === 'string') {
                      value = value.toLowerCase();
                    } else if (
                      rule.transformFunction === 'uppercase' &&
                      typeof value === 'string'
                    ) {
                      value = value.toUpperCase();
                    }
                  }

                  mapped[rule.targetProperty] = value;
                }
              });

              mapped._id = index + 1;
              return mapped;
            }) || [],
        unmappedProperties: sourceSchema.properties
          .filter(
            (prop: PropertyInfo) =>
              !draftData.mappingRules!.some(
                (rule: PropertyMappingRule) => rule.sourceProperty === prop.name
              )
          )
          .map((prop: PropertyInfo) => prop.name),
        errors: [],
        statistics: {
          totalRecords: sourceSchema.sampleData?.length || 0,
          successfulMappings: draftData.mappingRules!.length,
          failedMappings: 0,
          duplicatesFound: Math.floor(Math.random() * 5),
          duplicatesResolved: Math.floor(Math.random() * 3),
        },
      };

      setPreviewResult(mockResult);

      const mockValidation: MappingValidationResult = {
        isValid: (mockResult.errors ?? []).length === 0,
        errors: (mockResult.errors ?? []).map((err) => ({
          property: err.property ?? 'mapping',
          message: err.message,
          suggestion: err.suggestion,
        })),
        warnings:
          mockResult.unmappedProperties && mockResult.unmappedProperties.length > 0
            ? [
                {
                  property: 'unmapped',
                  message: `${mockResult.unmappedProperties.length} source properties are not mapped`,
                  suggestion:
                    'Consider mapping all source properties for complete data transformation',
                },
              ]
            : [],
        coverage: (draftData.mappingRules!.length / sourceSchema.properties.length) * 100,
      };

      setValidationResult(mockValidation);
      onValidationResult(mockValidation);

      const endTime = performance.now();
      const endMemory = readHeapUsage();

      setExecutionTime(endTime - startTime);
      setMemoryUsage(Math.max(0, endMemory - startMemory));
    } catch (error) {
      console.error('Preview failed:', error);

      const errorResult: MappingPreviewResult = {
        success: false,
        mappedData: [],
        unmappedProperties: [],
        errors: [{ property: 'mapping', message: 'Failed to execute mapping preview' }],
        statistics: {
          totalRecords: 0,
          successfulMappings: 0,
          failedMappings: 0,
          duplicatesFound: 0,
          duplicatesResolved: 0,
        },
      };

      setPreviewResult(errorResult);
    } finally {
      setIsRunning(false);
    }
  }, [sourceSchema, targetSchema, draftData.mappingRules, onValidationResult]);

  const toggleRowExpansion = useCallback(
    (rowIndex: number) => {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(rowIndex)) {
        newExpanded.delete(rowIndex);
      } else {
        newExpanded.add(rowIndex);
      }
      setExpandedRows(newExpanded);
    },
    [expandedRows]
  );

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }, []);

  return {
    draftData,
    executionTime,
    expandedRows,
    formatBytes,
    isRunning,
    memoryUsage,
    previewResult,
    runPreview,
    selectedTab,
    setSelectedTab,
    toggleRowExpansion,
    validationResult,
  };
}

const hasMemory = (
  perf: Performance
): perf is Performance & { memory: { usedJSHeapSize?: number } } => {
  return typeof (perf as { memory?: unknown }).memory !== 'undefined';
};

const readHeapUsage = (): number => {
  if (typeof performance === 'undefined') return 0;
  if (!hasMemory(performance)) return 0;
  const memory = performance.memory;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : 0;
};
