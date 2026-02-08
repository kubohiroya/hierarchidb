import React from 'react';
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
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Rule as RuleIcon,
} from '@mui/icons-material';
import type { ResolverUpdaterPayload, SchemaInfo, ValidationRule } from '../../../common/types/index.js';
import { useValidationConfigStepView } from './useValidationConfigStepView.js';
import { ValidationRuleParameterFields, ValidationRuleTypeMenu } from './ValidationConfigStepViewElements.js';
import { useValidationConfigStep } from './useValidationConfigStep.js';

interface ValidationConfigStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
}

export const ValidationConfigStep: React.FC<ValidationConfigStepProps> = ({
  data,
  onUpdate,
  onValidationChange,
  sourceSchema,
  targetSchema,
}) => {
  const {
    availableProperties,
    closeRuleDialog,
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
  } = useValidationConfigStep({
    data,
    onUpdate,
    onValidationChange,
    sourceSchema,
    targetSchema,
  });

  const {
    parameterFieldsProps,
    ruleTypeMenuProps,
  } = useValidationConfigStepView({
    ruleFormData,
    updateRuleFormData,
  });

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
                {validationRules.map((rule: ValidationRule, index: number) => (
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
              {availableProperties.map((prop: string) => (
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
                parameters: {},
              })}
              label="Rule Type"
            >
              <ValidationRuleTypeMenu {...ruleTypeMenuProps} />
            </Select>
          </FormControl>

          <ValidationRuleParameterFields {...parameterFieldsProps} />

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
