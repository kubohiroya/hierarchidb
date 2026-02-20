import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MappingPreviewResult,
  PropertyInfo,
  PropertyMappingRule,
  ResolverUpdaterPayload,
  SchemaInfo,
} from '~/common/types/index';

interface UsePropertyMappingStepArgs {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
}

export const usePropertyMappingStep = ({
  data,
  onUpdate,
  onValidationChange,
  sourceSchema,
  targetSchema,
}: UsePropertyMappingStepArgs) => {
  const draftData = data.draftData ?? {};
  const [mappingText, setMappingText] = useState<string>('');
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [previewResult, setPreviewResult] = useState<MappingPreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const parseMappingRules = useCallback(
    (text: string): { rules: PropertyMappingRule[]; errors: string[] } => {
      const lines = text.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));
      const rules: PropertyMappingRule[] = [];
      const errors: string[] = [];

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const simpleMatch = trimmed.match(/^(.+?)\s*->\s*(.+?)(\s*\|\s*(.+))?$/);

        if (simpleMatch) {
          const sourceProperty = simpleMatch[1]?.trim() || '';
          const targetProperty = simpleMatch[2]?.trim() || '';
          const transformFunction = simpleMatch[4]?.trim();

          if (sourceSchema && !sourceSchema.properties?.some((p: PropertyInfo) => p.name === sourceProperty)) {
            errors.push(`Line ${index + 1}: Source property "${sourceProperty}" not found in source schema`);
          }
          if (targetSchema && !targetSchema.properties?.some((p: PropertyInfo) => p.name === targetProperty)) {
            errors.push(`Line ${index + 1}: Target property "${targetProperty}" not found in target schema`);
          }

          rules.push({
            id: crypto.randomUUID(),
            sourceProperty,
            targetProperty,
            transformFunction,
            isRequired: false,
            description: `Map ${sourceProperty} to ${targetProperty}`,
          });
        } else {
          errors.push(`Line ${index + 1}: Invalid mapping syntax. Use: source_prop -> target_prop`);
        }
      });

      return { rules, errors };
    },
    [sourceSchema, targetSchema]
  );

  const formatMappingRules = useCallback((rules: PropertyMappingRule[]): string => {
    return rules
      .map((rule: PropertyMappingRule) => {
        let line = `${rule.sourceProperty} -> ${rule.targetProperty}`;
        if (rule.transformFunction) {
          line += ` | ${rule.transformFunction}`;
        }
        return line;
      })
      .join('\n');
  }, []);

  useEffect(() => {
    if (draftData.mappingRules && draftData.mappingRules.length > 0 && !mappingText) {
      setMappingText(formatMappingRules(draftData.mappingRules));
    }
  }, [draftData.mappingRules, mappingText, formatMappingRules]);

  const handleMappingTextChange = useCallback(
    (text: string) => {
      setMappingText(text);

      if (!text.trim()) {
        setMappingErrors([]);
        onUpdate({ draftData: { mappingRules: [] } });
        return;
      }

      const { rules, errors } = parseMappingRules(text);
      setMappingErrors(errors);
      onUpdate({ draftData: { mappingRules: rules } });
    },
    [onUpdate, parseMappingRules]
  );

  useEffect(() => {
    const hasRules = mappingText.trim().length > 0;
    const hasNoErrors = mappingErrors.length === 0;
    const isValid = hasRules && hasNoErrors;
    onValidationChange(isValid);
  }, [mappingText, mappingErrors, onValidationChange]);

  const suggestedMappings = useMemo(() => {
    if (!sourceSchema || !targetSchema) return [];

    const suggestions: string[] = [];

    sourceSchema.properties.forEach((sourceProp: PropertyInfo) => {
      const exactMatch = targetSchema.properties.find((targetProp: PropertyInfo) => targetProp.name === sourceProp.name);
      if (exactMatch) {
        suggestions.push(`${sourceProp.name} -> ${exactMatch.name}`);
      }
    });

    sourceSchema.properties.forEach((sourceProp: PropertyInfo) => {
      const similarMatch = targetSchema.properties.find((targetProp: PropertyInfo) => {
        const sourceLower = sourceProp.name.toLowerCase();
        const targetLower = targetProp.name.toLowerCase();
        return sourceLower.includes(targetLower) || targetLower.includes(sourceLower);
      });

      if (similarMatch && !suggestions.some((s: string) => s.includes(sourceProp.name))) {
        suggestions.push(`${sourceProp.name} -> ${similarMatch.name}`);
      }
    });

    return suggestions.slice(0, 10);
  }, [sourceSchema, targetSchema]);

  const addSuggestion = useCallback(
    (suggestion: string) => {
      const newText = mappingText ? `${mappingText}\n${suggestion}` : suggestion;
      handleMappingTextChange(newText);
    },
    [handleMappingTextChange, mappingText]
  );

  const generatePreview = useCallback(() => {
    if (!sourceSchema || !draftData.mappingRules) return;

    const mockPreview: MappingPreviewResult = {
      success: true,
      mappedData:
        sourceSchema.sampleData
          ?.slice(0, 3)
          .map((sample: Record<string, unknown>) => {
            const mapped: Record<string, unknown> = {};
            draftData.mappingRules!.forEach((rule: PropertyMappingRule) => {
              if (sample && typeof sample === 'object' && rule.sourceProperty in sample) {
                mapped[rule.targetProperty] = (sample as Record<string, unknown>)[rule.sourceProperty];
              }
            });
            return mapped;
          }) || [],
      unmappedProperties:
        sourceSchema.properties
          .filter((prop: PropertyInfo) => !draftData.mappingRules!.some((rule: PropertyMappingRule) => rule.sourceProperty === prop.name))
          .map((prop: PropertyInfo) => prop.name),
      errors: mappingErrors.map((message) => ({ property: 'mapping', message })),
      statistics: {
        totalRecords: sourceSchema.sampleData?.length || 0,
        successfulMappings: draftData.mappingRules!.length,
        failedMappings: mappingErrors.length,
        duplicatesFound: 0,
        duplicatesResolved: 0,
      },
    };

    setPreviewResult(mockPreview);
    setShowPreview(true);
  }, [draftData.mappingRules, mappingErrors, sourceSchema]);

  return {
    mappingText,
    mappingErrors,
    showHelp,
    setShowHelp,
    previewResult,
    showPreview,
    setShowPreview,
    handleMappingTextChange,
    suggestedMappings,
    addSuggestion,
    generatePreview,
  };
};
