import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResolverUpdaterPayload, SchemaInfo, ValidationRule } from '../../../common/types/index.js';

interface ValidationRuleFormData {
  property: string;
  ruleType: ValidationRule['ruleType'];
  parameters: Record<string, unknown>;
  errorMessage: string;
}

interface UseValidationConfigStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
}

export function useValidationConfigStep({
  data,
  onUpdate,
  onValidationChange,
  sourceSchema,
  targetSchema,
}: UseValidationConfigStepProps) {
  const draftData = data.draftData ?? {};
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState<ValidationRuleFormData>({
    property: '',
    ruleType: 'required',
    parameters: {},
    errorMessage: '',
  });
  const [enableValidation, setEnableValidation] = useState(true);

  useEffect(() => {
    if (draftData.validationRules) {
      setValidationRules(draftData.validationRules);
    }
  }, [draftData.validationRules]);

  useEffect(() => {
    onUpdate({ draftData: { validationRules } });
  }, [validationRules, onUpdate]);

  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  const availableProperties = useMemo(() => {
    const properties = new Set<string>();
    if (sourceSchema) {
      sourceSchema.properties.forEach((prop: { name: string }) => properties.add(`source.${prop.name}`));
    }
    if (targetSchema) {
      targetSchema.properties.forEach((prop: { name: string }) => properties.add(`target.${prop.name}`));
    }
    return Array.from(properties);
  }, [sourceSchema, targetSchema]);

  const openRuleDialog = useCallback((rule?: ValidationRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleFormData({
        property: rule.property,
        ruleType: rule.ruleType,
        parameters: { ...rule.parameters },
        errorMessage: rule.errorMessage || '',
      });
    } else {
      setEditingRule(null);
      setRuleFormData({
        property: '',
        ruleType: 'required',
        parameters: {},
        errorMessage: '',
      });
    }
    setShowRuleDialog(true);
  }, []);

  const closeRuleDialog = useCallback(() => {
    setShowRuleDialog(false);
    setEditingRule(null);
    setRuleFormData({
      property: '',
      ruleType: 'required',
      parameters: {},
      errorMessage: '',
    });
  }, []);

  const saveRule = useCallback(() => {
    const rule: ValidationRule = {
      id: editingRule?.id || crypto.randomUUID(),
      property: ruleFormData.property,
      ruleType: ruleFormData.ruleType,
      parameters: { ...ruleFormData.parameters },
      errorMessage: ruleFormData.errorMessage || undefined,
    };

    if (editingRule) {
      setValidationRules((prev: ValidationRule[]) => prev.map((r: ValidationRule) => r.id === rule.id ? rule : r));
    } else {
      setValidationRules(prev => [...prev, rule]);
    }

    closeRuleDialog();
  }, [editingRule, ruleFormData, closeRuleDialog]);

  const deleteRule = useCallback((ruleId: string) => {
    setValidationRules(prev => prev.filter(r => r.id !== ruleId));
  }, []);

  const updateRuleFormData = useCallback((updates: Partial<ValidationRuleFormData>) => {
    setRuleFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const formatRuleDescription = useCallback((rule: ValidationRule) => {
    switch (rule.ruleType) {
      case 'required':
        return 'Must have a value';
      case 'type':
        return `Must be of type: ${rule.parameters.expectedType}`;
      case 'range':{
        const min = rule.parameters.min;
        const max = rule.parameters.max;
        return `Range: ${min ?? '-'} to ${max ?? '-'}`;
      }
      case 'pattern':
        return `Pattern: ${rule.parameters.pattern}`;
      case 'custom':
        return 'Custom validation function';
      default:
        return 'Unknown rule';
    }
  }, []);

  return {
    availableProperties,
    deleteRule,
    editingRule,
    enableValidation,
    formatRuleDescription,
    openRuleDialog,
    ruleFormData,
    saveRule,
    setEnableValidation,
    showRuleDialog,
    updateRuleFormData,
    validationRules,
    closeRuleDialog,
  };
}
