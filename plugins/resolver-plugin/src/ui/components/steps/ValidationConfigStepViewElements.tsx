import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type { ReactElement } from 'react';
import type { ValidationRule } from '~/common/entities/ResolverEntity';

export type ValidationRuleTypeOption = {
  value: ValidationRule['ruleType'];
  label: string;
  description: string;
};

export type ValidationRuleTypeMenuProps = {
  options: ValidationRuleTypeOption[];
};

export const ValidationRuleTypeMenu = ({ options }: ValidationRuleTypeMenuProps): ReactElement => (
  <>
    {options.map((type) => (
      <MenuItem key={type.value} value={type.value}>
        <Box>
          <Typography variant="body2">{type.label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {type.description}
          </Typography>
        </Box>
      </MenuItem>
    ))}
  </>
);

export type ValidationRuleParameterFieldsProps = {
  ruleType: ValidationRule['ruleType'];
  parameters: Record<string, unknown>;
  updateRuleFormData: (updates: { parameters?: Record<string, unknown> }) => void;
};

export const ValidationRuleParameterFields = ({
  ruleType,
  parameters,
  updateRuleFormData,
}: ValidationRuleParameterFieldsProps): ReactElement | null => {
  switch (ruleType) {
    case 'type':
      return (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Expected Type</InputLabel>
          <Select
            value={parameters.expectedType || 'string'}
            onChange={(e) =>
              updateRuleFormData({
                parameters: { ...parameters, expectedType: e.target.value },
              })
            }
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
              value={parameters.min || ''}
              onChange={(e) =>
                updateRuleFormData({
                  parameters: { ...parameters, min: parseFloat(e.target.value) || undefined },
                })
              }
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              label="Maximum Value"
              type="number"
              value={parameters.max || ''}
              onChange={(e) =>
                updateRuleFormData({
                  parameters: { ...parameters, max: parseFloat(e.target.value) || undefined },
                })
              }
            />
          </Grid>
        </Grid>
      );

    case 'pattern':
      return (
        <TextField
          fullWidth
          label="Regex Pattern"
          value={parameters.pattern || ''}
          onChange={(e) =>
            updateRuleFormData({
              parameters: { ...parameters, pattern: e.target.value },
            })
          }
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
          value={parameters.function || ''}
          onChange={(e) =>
            updateRuleFormData({
              parameters: { ...parameters, function: e.target.value },
            })
          }
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
