import type { ValidationRule } from '../../../common/types/index.js';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';

const VALIDATION_RULE_TYPES: { value: ValidationRule['ruleType'], label: string, description: string }[] = [
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
  const renderParameterFields = () => {
    switch (ruleFormData.ruleType) {
      case 'type':
        return (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Expected Type</InputLabel>
            <Select
              value={ruleFormData.parameters.expectedType || 'string'}
              onChange={(e) => updateRuleFormData({
                parameters: { ...ruleFormData.parameters, expectedType: e.target.value },
              })}
              label="Expected Type"
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
              <MenuItem value="array">Array</MenuItem>
              <MenuItem value="object">Object</MenuItem>
            </Select>
          </FormControl>
        );

      case 'range':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Minimum Value"
                type="number"
                value={ruleFormData.parameters.min || ''}
                onChange={(e) => updateRuleFormData({
                  parameters: { ...ruleFormData.parameters, min: parseFloat(e.target.value) || undefined },
                })}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                label="Maximum Value"
                type="number"
                value={ruleFormData.parameters.max || ''}
                onChange={(e) => updateRuleFormData({
                  parameters: { ...ruleFormData.parameters, max: parseFloat(e.target.value) || undefined },
                })}
              />
            </Grid>
          </Grid>
        );

      case 'pattern':
        return (
          <TextField
            fullWidth
            label="Regex Pattern"
            value={ruleFormData.parameters.pattern || ''}
            onChange={(e) => updateRuleFormData({
              parameters: { ...ruleFormData.parameters, pattern: e.target.value },
            })}
            placeholder="^[A-Z][a-z]+$"
            helperText="Enter a JavaScript regular expression"
            sx={{ mb: 2 }}
          />
        );

      case 'custom':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Custom Validation Function"
            value={ruleFormData.parameters.function || ''}
            onChange={(e) => updateRuleFormData({
              parameters: { ...ruleFormData.parameters, function: e.target.value },
            })}
            placeholder="function validate(value) { return value.length > 0; }"
            helperText="JavaScript function that returns true for valid values"
            sx={{ mb: 2 }}
          />
        );

      case 'required':
      default:
        return null;
    }
  };

  const ruleTypeMenu = VALIDATION_RULE_TYPES.map((type) => (
    <MenuItem key={type.value} value={type.value}>
      <Box>
        <Typography variant="body2">{type.label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {type.description}
        </Typography>
      </Box>
    </MenuItem>
  ));

  return {
    validationRuleTypes: VALIDATION_RULE_TYPES,
    renderParameterFields,
    ruleTypeMenu,
  };
};
