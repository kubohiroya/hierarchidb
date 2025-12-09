import { useCallback, useEffect, useState } from 'react';
import type { PropertyInfo, ResolverUpdaterPayload, SchemaInfo } from '../../../../common/types/index.js';

interface UseSchemaSelectionStepArgs {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  onSourceSchemaChange: (schema: SchemaInfo | null) => void;
  onTargetSchemaChange: (schema: SchemaInfo | null) => void;
}

const parseSchemaFromSample = (jsonText: string, schemaName: string): SchemaInfo | null => {
  try {
    const parsed = JSON.parse(jsonText);
    const sampleArray = Array.isArray(parsed) ? parsed : [parsed];
    if (sampleArray.length === 0) {
      throw new Error('No data found in sample');
    }

    const allProperties = new Set<string>();
    const propertyTypes = new Map<string, string>();
    const propertyExamples = new Map<string, unknown[]>();

    sampleArray.slice(0, 10).forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach((key) => {
          allProperties.add(key);
          const value = item[key];
          const type = Array.isArray(value)
            ? 'array'
            : value === null
              ? 'string'
              : typeof value === 'object'
                ? 'object'
                : typeof value === 'number'
                  ? 'number'
                  : typeof value === 'boolean'
                    ? 'boolean'
                    : typeof value;

          propertyTypes.set(key, type);

          if (!propertyExamples.has(key)) {
            propertyExamples.set(key, []);
          }
          const examples = propertyExamples.get(key)!;
          if (examples.length < 3 && value !== null && value !== undefined) {
            examples.push(value);
          }
        });
      }
    });

    const properties: PropertyInfo[] = Array.from(allProperties).map((name: string) => ({
      name,
      type: (propertyTypes.get(name) as PropertyInfo['type']) || 'string',
      required: false,
      exampleValues: propertyExamples.get(name) || [],
    }));

    return {
      name: schemaName,
      properties,
      sampleData: sampleArray.slice(0, 5),
    };
  } catch (error) {
    console.error('Failed to parse schema from sample:', error);
    return null;
  }
};

export const useSchemaSelectionStep = ({
  data,
  onUpdate,
  onValidationChange,
  onSourceSchemaChange,
  onTargetSchemaChange,
}: UseSchemaSelectionStepArgs) => {
  const draftData = data.draftData ?? {};
  const [sourceInputMethod, setSourceInputMethod] = useState<string>('sample');
  const [targetInputMethod, setTargetInputMethod] = useState<string>('sample');
  const [sourceInput, setSourceInput] = useState<string>('');
  const [targetInput, setTargetInput] = useState<string>('');
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(draftData.sourceSchema ?? null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(draftData.targetSchema ?? null);
  const [sourceError, setSourceError] = useState<string>('');
  const [targetError, setTargetError] = useState<string>('');

  const handleSourceInputChange = useCallback(
    (value: string) => {
      setSourceInput(value);
      setSourceError('');

      if (value.trim()) {
        const schema = parseSchemaFromSample(value, 'Source Schema');
        if (schema) {
          setSourceSchema(schema);
          onSourceSchemaChange(schema);
          onUpdate({ draftData: { sourceSchema: schema } });
          return;
        }
        setSourceError('Invalid JSON format or structure');
      }
      setSourceSchema(null);
      onSourceSchemaChange(null);
      onUpdate({ draftData: { sourceSchema: null } });
    },
    [onSourceSchemaChange, onUpdate]
  );

  const handleTargetInputChange = useCallback(
    (value: string) => {
      setTargetInput(value);
      setTargetError('');

      if (value.trim()) {
        const schema = parseSchemaFromSample(value, 'Target Schema');
        if (schema) {
          setTargetSchema(schema);
          onTargetSchemaChange(schema);
          onUpdate({ draftData: { targetSchema: schema } });
          return;
        }
        setTargetError('Invalid JSON format or structure');
      }
      setTargetSchema(null);
      onTargetSchemaChange(null);
      onUpdate({ draftData: { targetSchema: null } });
    },
    [onTargetSchemaChange, onUpdate]
  );

  useEffect(() => {
    if (draftData.sourceSchema && !sourceSchema) {
      setSourceSchema(draftData.sourceSchema);
      onSourceSchemaChange(draftData.sourceSchema);
      if (!sourceInput && Array.isArray(draftData.sourceSchema.sampleData)) {
        setSourceInput(JSON.stringify(draftData.sourceSchema.sampleData, null, 2));
      }
    }
    if (draftData.targetSchema && !targetSchema) {
      setTargetSchema(draftData.targetSchema);
      onTargetSchemaChange(draftData.targetSchema);
      if (!targetInput && Array.isArray(draftData.targetSchema.sampleData)) {
        setTargetInput(JSON.stringify(draftData.targetSchema.sampleData, null, 2));
      }
    }
  }, [
    draftData.sourceSchema,
    draftData.targetSchema,
    onSourceSchemaChange,
    onTargetSchemaChange,
    sourceInput,
    sourceSchema,
    targetInput,
    targetSchema,
  ]);

  useEffect(() => {
    const isValid = sourceSchema !== null && targetSchema !== null && !sourceError && !targetError;
    onValidationChange(isValid);
  }, [sourceSchema, targetSchema, sourceError, targetError, onValidationChange]);

  return {
    sourceInputMethod,
    targetInputMethod,
    setSourceInputMethod,
    setTargetInputMethod,
    sourceInput,
    targetInput,
    handleSourceInputChange,
    handleTargetInputChange,
    sourceSchema,
    targetSchema,
    sourceError,
    targetError,
  };
};
