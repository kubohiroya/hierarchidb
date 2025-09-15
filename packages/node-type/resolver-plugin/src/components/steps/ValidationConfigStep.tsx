import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Rule as RuleIcon,
} from '@mui/icons-material';
import type { ResolverWorkingCopyEntity, SchemaInfo, ValidationRule } from '~/types';

interface ValidationConfigStepProps {
  data: Partial<ResolverWorkingCopyEntity>;
  onUpdate: (updates: Partial<ResolverWorkingCopyEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
}

interface ValidationRuleFormData {
  property: string;
  ruleType: ValidationRule['ruleType'];
  parameters: Record<string, unknown>;
  errorMessage: string;
}

const VALIDATION_RULE_TYPES: { value: ValidationRule['ruleType'], label: string, description: string }[] = [
  { value: 'required', label: 'Required', description: 'Property must have a value' },
  { value: 'type', label: 'Type Check', description: 'Property must be of specified type' },
  { value: 'range', label: 'Range', description: 'Numeric value must be within range' },
  { value: 'pattern', label: 'Pattern', description: 'String value must match regex pattern' },
  { value: 'custom', label: 'Custom', description: 'Custom validation function' },
];

export const ValidationConfigStep: React.FC<ValidationConfigStepProps> = ({
                                                                            data,
                                                                            onUpdate,
                                                                            onValidationChange,
                                                                            sourceSchema,
                                                                            targetSchema,
                                                                          }) => {
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

  // Initialize validation rules from data
  useEffect(() => {
    if (data.validationRules) {
      setValidationRules(data.validationRules);
    }
  }, [data.validationRules]);

  // Update parent data when validation rules change
  useEffect(() => {
    onUpdate({ validationRules });
  }, [validationRules, onUpdate]);

  // Always consider this step valid (validation is optional)
  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  const availableProperties = React.useMemo(() => {
    const properties = new Set<string>();
    if (sourceSchema) {
      sourceSchema.properties.forEach(prop => properties.add(`source.${prop.name}`));
    }
    if (targetSchema) {
      targetSchema.properties.forEach(prop => properties.add(`target.${prop.name}`));
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
      setValidationRules(prev => prev.map(r => r.id === rule.id ? rule : r));
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

      default:
        return null;
    }
  };

  const formatRuleDescription = (rule: ValidationRule) => {
    switch (rule.ruleType) {
      case 'required':
        return 'Must have a value';
      case 'type':
        return `Must be of type: ${rule.parameters.expectedType}`;
      case 'range':
        const min = rule.parameters.min;
        const max = rule.parameters.max;
        if (min !== undefined && max !== undefined) {
          return `Must be between ${min} and ${max}`;
        } else if (min !== undefined) {
          return `Must be at least ${min}`;
        } else if (max !== undefined) {
          return `Must be at most ${max}`;
        }
        return 'Range validation';
      case 'pattern':
        return `Must match pattern: ${rule.parameters.pattern}`;
      case 'custom':
        return 'Custom validation function';
      default:
        return 'Validation rule';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Validation Rules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure validation rules to ensure data quality during property mapping. These rules will be applied to check
        data integrity.
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={enableValidation}
            onChange={(e) => setEnableValidation(e.target.checked)}
          />
        }
        label="Enable validation rules"
        sx={{ mb: 3 }}
      />

      {enableValidation && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              <RuleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Validation Rules ({validationRules.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={() => openRuleDialog()}
              variant="outlined"
              disabled={availableProperties.length === 0}
            >
              Add Rule
            </Button>
          </Box>

          {availableProperties.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No properties available for validation. Please complete the Schema Selection step first.
            </Alert>
          )}

          {validationRules.length === 0 && enableValidation && availableProperties.length > 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary">
                No validation rules defined. Click "Add Rule" to create your first validation rule.
              </Typography>
            </Paper>
          )}

          {validationRules.length > 0 && (
            <Paper sx={{ mb: 2 }}>
              <List>
                {validationRules.map((rule, index) => (
                  <React.Fragment key={rule.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={rule.property}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              label={rule.ruleType}
                              size="small"
                              color="secondary"
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              {formatRuleDescription(rule)}
                            </Typography>
                            {rule.errorMessage && (
                              <Typography variant="caption" color="error">
                                Error message: {rule.errorMessage}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={() => openRuleDialog(rule)}
                          size="small"
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => deleteRule(rule.id)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < validationRules.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}

          {validationRules.length > 0 && (
            <Alert severity="info">
              <Typography variant="body2">
                Validation rules will be applied during property mapping to ensure data quality.
                Failed validation will be reported in the mapping results.
              </Typography>
            </Alert>
          )}
        </>
      )}

      {!enableValidation && (
        <Alert severity="info">
          <Typography variant="body2">
            Validation is disabled. Data will be mapped without quality checks.
          </Typography>
        </Alert>
      )}

      {/* Rule Dialog */}
      <Dialog open={showRuleDialog} onClose={closeRuleDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {editingRule ? 'Edit Validation Rule' : 'Add Validation Rule'}
            <IconButton onClick={closeRuleDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Property</InputLabel>
            <Select
              value={ruleFormData.property}
              onChange={(e) => updateRuleFormData({ property: e.target.value })}
              label="Property"
            >
              {availableProperties.map((prop) => (
                <MenuItem key={prop} value={prop}>
                  {prop}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rule Type</InputLabel>
            <Select
              value={ruleFormData.ruleType}
              onChange={(e) => updateRuleFormData({
                ruleType: e.target.value as ValidationRule['ruleType'],
                parameters: {}, // Reset parameters when rule type changes
              })}
              label="Rule Type"
            >
              {VALIDATION_RULE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box>
                    <Typography variant="body2">{type.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {type.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {renderParameterFields()}

          <TextField
            fullWidth
            label="Custom Error Message (Optional)"
            value={ruleFormData.errorMessage}
            onChange={(e) => updateRuleFormData({ errorMessage: e.target.value })}
            placeholder="This field is required"
            helperText="Custom error message to show when validation fails"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRuleDialog}>Cancel</Button>
          <Button
            onClick={saveRule}
            variant="contained"
            disabled={!ruleFormData.property || !ruleFormData.ruleType}
          >
            {editingRule ? 'Update' : 'Add'} Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
