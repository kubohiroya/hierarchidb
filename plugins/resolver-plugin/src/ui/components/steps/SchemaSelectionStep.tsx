import { CheckCircle as CheckIcon, Schema as SchemaIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type React from 'react';
import { useId } from 'react';
import type { PropertyInfo, ResolverUpdaterPayload, SchemaInfo } from '~/common/entities/ResolverEntity';
import { useSchemaSelectionStep } from './hooks/useSchemaSelectionStep.js';

interface SchemaSelectionStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  onSourceSchemaChange: (schema: SchemaInfo | null) => void;
  onTargetSchemaChange: (schema: SchemaInfo | null) => void;
}

const SCHEMA_INPUT_METHODS = [
  { value: 'json', label: 'JSON Schema' },
  { value: 'sample', label: 'Sample Data' },
  { value: 'manual', label: 'Manual Definition' },
];

export const SchemaSelectionStep: React.FC<SchemaSelectionStepProps> = ({
  data,
  onUpdate,
  onValidationChange,
  onSourceSchemaChange,
  onTargetSchemaChange,
}) => {
  const controlId = useId();
  const {
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
  } = useSchemaSelectionStep({
    data,
    onUpdate,
    onValidationChange,
    onSourceSchemaChange,
    onTargetSchemaChange,
  });

  const SchemaPreview: React.FC<{ schema: SchemaInfo; title: string }> = ({ schema, title }) => (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <CheckIcon color="success" sx={{ mr: 1 }} />
        <Typography variant="subtitle2">{title}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {schema.properties.length} properties detected
      </Typography>
      <List dense>
        {schema.properties.slice(0, 8).map((prop: PropertyInfo) => (
          <ListItem key={prop.name} sx={{ py: 0.5 }}>
            <ListItemText
              primary={prop.name}
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={prop.type} size="small" variant="outlined" />
                  {prop.exampleValues && prop.exampleValues.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      e.g. {String(prop.exampleValues[0])}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
        {schema.properties.length > 8 && (
          <ListItem>
            <ListItemText secondary={`... and ${schema.properties.length - 8} more properties`} />
          </ListItem>
        )}
      </List>
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Schema Selection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define your source and target data schemas. You can paste sample JSON data to automatically
        detect the schema structure.
      </Typography>

      <Grid container spacing={3}>
        {/* Source Schema */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
            <SchemaIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Source Schema
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id={`${controlId}-source-input-method-label`}>Input Method</InputLabel>
            <Select
              labelId={`${controlId}-source-input-method-label`}
              id={`${controlId}-source-input-method`}
              value={sourceInputMethod}
              onChange={(e) => setSourceInputMethod(e.target.value)}
              label="Input Method"
            >
              {SCHEMA_INPUT_METHODS.map((method: (typeof SCHEMA_INPUT_METHODS)[number]) => (
                <MenuItem key={method.value} value={method.value}>
                  {method.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={8}
            label="Paste sample JSON data"
            id={`${controlId}-source-sample-json`}
            name="source-sample-json"
            value={sourceInput}
            onChange={(e) => handleSourceInputChange(e.target.value)}
            placeholder="[{&quot;id&quot;: 1, &quot;name&quot;: &quot;John&quot;, &quot;age&quot;: 30}, ...]"
            error={!!sourceError}
            helperText={sourceError || 'Paste sample JSON data to auto-detect schema'}
            inputProps={{ id: `${controlId}-source-sample-json`, name: 'source-sample-json' }}
          />

          {sourceSchema && <SchemaPreview schema={sourceSchema} title="Source Schema Detected" />}
        </Grid>

        {/* Target Schema */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
            <SchemaIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Target Schema
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id={`${controlId}-target-input-method-label`}>Input Method</InputLabel>
            <Select
              labelId={`${controlId}-target-input-method-label`}
              id={`${controlId}-target-input-method`}
              value={targetInputMethod}
              onChange={(e) => setTargetInputMethod(e.target.value)}
              label="Input Method"
            >
              {SCHEMA_INPUT_METHODS.map((method: (typeof SCHEMA_INPUT_METHODS)[number]) => (
                <MenuItem key={method.value} value={method.value}>
                  {method.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={8}
            label="Paste sample JSON data"
            id={`${controlId}-target-sample-json`}
            name="target-sample-json"
            value={targetInput}
            onChange={(e) => handleTargetInputChange(e.target.value)}
            placeholder="[{&quot;user_id&quot;: 1, &quot;full_name&quot;: &quot;John Doe&quot;, &quot;years&quot;: 30}, ...]"
            error={!!targetError}
            helperText={targetError || 'Paste sample JSON data to auto-detect schema'}
            inputProps={{ id: `${controlId}-target-sample-json`, name: 'target-sample-json' }}
          />

          {targetSchema && <SchemaPreview schema={targetSchema} title="Target Schema Detected" />}
        </Grid>
      </Grid>

      {sourceSchema && targetSchema && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">Schemas Ready</Typography>
          Both source and target schemas have been successfully detected. You can now proceed to
          define property mapping rules.
        </Alert>
      )}

      {(sourceError || targetError) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Please fix the schema errors before proceeding to the next step.
        </Alert>
      )}
    </Box>
  );
};
