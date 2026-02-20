import type React from 'react';
import { useId } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon, Close as CloseIcon, Help as HelpIcon, Preview as PreviewIcon } from '@mui/icons-material';
import type { ResolverUpdaterPayload, SchemaInfo, PropertyInfo } from '~/common/types/index';
import { usePropertyMappingStep } from './hooks/usePropertyMappingStep.js';

interface PropertyMappingStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
}

export const PropertyMappingStep: React.FC<PropertyMappingStepProps> = ({
                                                                          data,
                                                                          onUpdate,
                                                                          onValidationChange,
                                                                          sourceSchema,
  targetSchema,
}) => {
  const controlId = useId();
  const {
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
  } = usePropertyMappingStep({
    data,
    onUpdate,
    onValidationChange,
    sourceSchema,
    targetSchema,
  });

  if (!sourceSchema || !targetSchema) {
    return (
      <Alert severity="warning">
        Please complete the Schema Selection step before defining property mappings.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Property Mapping Rules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Define how properties from the source schema map to the target schema using simple text rules.
      </Typography>

      <Grid container spacing={3}>
        {/* Mapping Rules Input */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              Mapping Rules
            </Typography>
            <Tooltip title="Show mapping syntax help">
              <IconButton onClick={() => setShowHelp(true)} size="small">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Preview mapping results">
              <IconButton
                onClick={generatePreview}
                size="small"
                disabled={mappingErrors.length > 0 || !mappingText.trim()}
              >
                <PreviewIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={12}
            id={`${controlId}-mapping-rules`}
            name="mapping-rules"
            value={mappingText}
            onChange={(e) => handleMappingTextChange(e.target.value)}
            placeholder="# Define your mapping rules here (one per line)&#10;id -> user_id&#10;name -> full_name&#10;age -> years&#10;email -> email_address | lowercase"
            error={mappingErrors.length > 0}
            helperText={mappingErrors.length > 0 ? `${mappingErrors.length} error(s) found` : 'One mapping rule per line'}
            sx={{ fontFamily: 'monospace' }}
            inputProps={{ id: `${controlId}-mapping-rules`, name: 'mapping-rules' }}
          />

          {mappingErrors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Mapping Errors:</Typography>
              <List dense>
                {mappingErrors.map((error: string, index: number) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemText primary={error} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Grid>

        {/* Schema Reference and Suggestions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Suggested Mappings
          </Typography>

          {suggestedMappings.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Click to add suggested mappings:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {suggestedMappings.map((suggestion: string, index: number) => (
                  <Button
                    key={index}
                    variant="outlined"
                    size="small"
                    onClick={() => addSuggestion(suggestion)}
                    startIcon={<AddIcon />}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Box>
            </Paper>
          )}

          {/* Source Properties Reference */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Source Properties ({sourceSchema.properties.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {sourceSchema.properties.map((prop: PropertyInfo) => (
                <Chip
                  key={prop.name}
                  label={prop.name}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Paper>

          {/* Target Properties Reference */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Target Properties ({targetSchema.properties.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {targetSchema.properties.map((prop: PropertyInfo) => (
                <Chip
                  key={prop.name}
                  label={prop.name}
                  size="small"
                  variant="outlined"
                  color="secondary"
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Help Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Mapping Rules Syntax
            <IconButton onClick={() => setShowHelp(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Use simple text rules to define how properties map from source to target schema:
          </Typography>

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Basic Syntax</Typography>
            <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', mb: 1 }}>
              source_property -&gt; target_property
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Maps source_property directly to target_property
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>With Transformation</Typography>
            <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', mb: 1 }}>
              source_property -&gt; target_property | transform_function
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Apply a transformation function during mapping
            </Typography>
          </Paper>

          <Typography variant="h6" sx={{ mb: 1 }}>Examples</Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', whiteSpace: 'pre' }}>
              {`# Direct mapping
id -> user_id
name -> full_name

# With transformations  
email -> email_address | lowercase
price -> cost | multiply(1.1)
date -> created_at | parse_date

# Comments start with #
# age -> years  (this is commented out)`}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Mapping Preview
            <IconButton onClick={() => setShowPreview(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewResult && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Preview Results</Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Sample Mapped Data</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
                      {JSON.stringify(previewResult.mappedData, null, 2)}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Statistics</Typography>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2">Total Records: {previewResult.statistics?.totalRecords ?? 0}</Typography>
                    <Typography variant="body2">Successful
                      Mappings: {previewResult.statistics?.successfulMappings ?? 0}</Typography>
                    <Typography variant="body2">Failed Mappings: {previewResult.statistics?.failedMappings ?? 0}</Typography>

                    {(previewResult.unmappedProperties?.length ?? 0) > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>Unmapped Source Properties:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {previewResult.unmappedProperties?.map((prop: string) => (
                            <Chip key={prop} label={prop} size="small" color="warning" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
