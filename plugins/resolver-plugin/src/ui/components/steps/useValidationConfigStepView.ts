import type { ValidationRule } from '../../../common/types/index.js';
import type { ValidationRuleParameterFieldsProps, ValidationRuleTypeMenuProps, ValidationRuleTypeOption } from './ValidationConfigStepViewElements.js';

const VALIDATION_RULE_TYPES: ValidationRuleTypeOption[] = [
  { value: 'required', label: 'Required', description: 'Property must have a value' },
  { value: 'type', label: 'Type Check', description: 'Property must be of specified type' },
  { value: 'range', label: 'Range', description: 'Numeric value must be within range' },
  { value: 'pattern', label: 'Pattern', description: 'String value must match regex pattern' },
  { value: 'custom', label: 'Custom', description: 'Custom validation function' },
];

export const useValidationConfigStepView = ({
  ruleFormData,
  updateRuleFormData,
}: {
  ruleFormData: {
    property: string;
    ruleType: ValidationRule['ruleType'];
    parameters: Record<string, unknown>;
    errorMessage: string;
  };
  updateRuleFormData: (updates: {
    property?: string;
    ruleType?: ValidationRule['ruleType'];
    parameters?: Record<string, unknown>;
    errorMessage?: string;
  }) => void;
}) => {
  const parameterFieldsProps: ValidationRuleParameterFieldsProps = {
    ruleType: ruleFormData.ruleType,
    parameters: ruleFormData.parameters,
    updateRuleFormData: (updates) => updateRuleFormData(updates),
  };

  const ruleTypeMenuProps: ValidationRuleTypeMenuProps = {
    options: VALIDATION_RULE_TYPES,
  };

  return {
    validationRuleTypes: VALIDATION_RULE_TYPES,
    parameterFieldsProps,
    ruleTypeMenuProps,
  };
};
