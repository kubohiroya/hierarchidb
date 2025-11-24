import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
import { CheckCircle as CheckIcon, Schema as SchemaIcon } from '@mui/icons-material';
import type { PropertyInfo, ResolverDraftEntity, SchemaInfo } from '../../../common/types/index.js';

interface SchemaSelectionStepProps {
  data: Partial<ResolverDraftEntity>;
  onUpdate: (updates: Partial<ResolverDraftEntity>) => void;
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
  const [sourceInputMethod, setSourceInputMethod] = useState<string>('sample');
  const [targetInputMethod, setTargetInputMethod] = useState<string>('sample');
  const [sourceInput, setSourceInput] = useState<string>('');
  const [targetInput, setTargetInput] = useState<string>('');
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(null);
  const [sourceError, setSourceError] = useState<string>('');
  const [targetError, setTargetError] = useState<string>('');

  const parseSchemaFromSample = useCallback((jsonText: string, schemaName: string): SchemaInfo | null => {
    try {
      const data = JSON.parse(jsonText);
      const sampleArray = Array.isArray(data) ? data : [data];

      if (sampleArray.length === 0) {
        throw new Error('No data found in sample');
      }

      // Extract properties from the first few samples
      const allProperties = new Set<string>();
      const propertyTypes = new Map<string, string>();
      const propertyExamples = new Map<string, unknown[]>();

      sampleArray.slice(0, 10).forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => {
            allProperties.add(key);
            const value = item[key];
            const type = Array.isArray(value) ? 'array'
              : value === null ? 'string'
                : typeof value === 'object' ? 'object'
                  : typeof value === 'number' ? 'number'
                    : typeof value === 'boolean' ? 'boolean'
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
        type: propertyTypes.get(name) as PropertyInfo['type'] || 'string',
        required: false, // Can't determine from sample alone
        exampleValues: propertyExamples.get(name) || [],
      }));

      return {
        name: schemaName,
        properties,
        sampleData: sampleArray.slice(0, 5), // Keep first 5 samples
      };
    } catch (error) {
      console.error('Failed to parse schema from sample:', error);
      return null;
    }
  }, []);

  const handleSourceInputChange = useCallback((value: string) => {
    setSourceInput(value);
    setSourceError('');

    if (value.trim()) {
      const schema = parseSchemaFromSample(value, 'Source Schema');
      if (schema) {
        setSourceSchema(schema);
        onSourceSchemaChange(schema);
        onUpdate({ sourceSchema: schema });
        return;
      }
      setSourceError('Invalid JSON format or structure');
    }
    setSourceSchema(null);
    onSourceSchemaChange(null);
    onUpdate({ sourceSchema: null });
  }, [parseSchemaFromSample, onSourceSchemaChange, onUpdate]);

  const handleTargetInputChange = useCallback((value: string) => {
    setTargetInput(value);
    setTargetError('');

    if (value.trim()) {
      const schema = parseSchemaFromSample(value, 'Target Schema');
      if (schema) {
        setTargetSchema(schema);
        onTargetSchemaChange(schema);
        onUpdate({ targetSchema: schema });
        return;
      }
      setTargetError('Invalid JSON format or structure');
    }
    setTargetSchema(null);
    onTargetSchemaChange(null);
    onUpdate({ targetSchema: null });
  }, [parseSchemaFromSample, onTargetSchemaChange, onUpdate]);

  // Initialize from existing data
  useEffect(() => {
    if (data.sourceSchema && !sourceSchema) {
      setSourceSchema(data.sourceSchema);
      onSourceSchemaChange(data.sourceSchema);
      if (!sourceInput && Array.isArray(data.sourceSchema.sampleData)) {
        setSourceInput(JSON.stringify(data.sourceSchema.sampleData, null, 2));
      }
    }
    if (data.targetSchema && !targetSchema) {
      setTargetSchema(data.targetSchema);
      onTargetSchemaChange(data.targetSchema);
      if (!targetInput && Array.isArray(data.targetSchema.sampleData)) {
        setTargetInput(JSON.stringify(data.targetSchema.sampleData, null, 2));
      }
    }
  }, [
    data.sourceSchema,
    data.targetSchema,
    handleSourceInputChange,
    handleTargetInputChange,
    onSourceSchemaChange,
    onTargetSchemaChange,
    sourceInput,
    sourceSchema,
    targetInput,
    targetSchema,
  ]);

  // Validation
  useEffect(() => {
    const isValid = sourceSchema !== null && targetSchema !== null && !sourceError && !targetError;
    onValidationChange(isValid);
  }, [sourceSchema, targetSchema, sourceError, targetError, onValidationChange]);

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
            <ListItemText
              secondary={`... and ${schema.properties.length - 8} more properties`}
            />
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
        Define your source and target data schemas. You can paste sample JSON data to automatically detect the schema
        structure.
      </Typography>

      <Grid container spacing={3}>
        {/* Source Schema */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
            <SchemaIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Source Schema
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Input Method</InputLabel>
            <Select
              value={sourceInputMethod}
              onChange={(e) => setSourceInputMethod(e.target.value)}
              label="Input Method"
            >
              {SCHEMA_INPUT_METHODS.map((method: typeof SCHEMA_INPUT_METHODS[number]) => (
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
            value={sourceInput}
            onChange={(e) => handleSourceInputChange(e.target.value)}
            placeholder="[{&quot;id&quot;: 1, &quot;name&quot;: &quot;John&quot;, &quot;age&quot;: 30}, ...]"
            error={!!sourceError}
            helperText={sourceError || 'Paste sample JSON data to auto-detect schema'}
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
            <InputLabel>Input Method</InputLabel>
            <Select
              value={targetInputMethod}
              onChange={(e) => setTargetInputMethod(e.target.value)}
              label="Input Method"
            >
              {SCHEMA_INPUT_METHODS.map((method: typeof SCHEMA_INPUT_METHODS[number]) => (
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
            value={targetInput}
            onChange={(e) => handleTargetInputChange(e.target.value)}
            placeholder="[{&quot;user_id&quot;: 1, &quot;full_name&quot;: &quot;John Doe&quot;, &quot;years&quot;: 30}, ...]"
            error={!!targetError}
            helperText={targetError || 'Paste sample JSON data to auto-detect schema'}
          />

          {targetSchema && <SchemaPreview schema={targetSchema} title="Target Schema Detected" />}
        </Grid>
      </Grid>

      {sourceSchema && targetSchema && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">Schemas Ready</Typography>
          Both source and target schemas have been successfully detected.
          You can now proceed to define property mapping rules.
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
