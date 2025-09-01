import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Paper,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Switch,
  Divider,
} from '@mui/material';
import { 
  MergeType as MergeIcon,
  SkipNext as SkipIcon,
  Update as UpdateIcon,
  Block as BlockIcon,
  Functions as FunctionsIcon,
} from '@mui/icons-material';
import type { 
  ResolverWorkingCopyEntity,
  DuplicateResolutionStrategy,
} from '~/types';

interface DuplicateResolutionStepProps {
  data: Partial<ResolverWorkingCopyEntity>;
  onUpdate: (updates: Partial<ResolverWorkingCopyEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const RESOLUTION_STRATEGIES = [
  {
    value: 'ignore' as const,
    label: 'Ignore Duplicates',
    description: 'Keep all duplicate entries without modification',
    icon: <BlockIcon />,
  },
  {
    value: 'overwrite' as const,
    label: 'Overwrite',
    description: 'Replace existing entries with new ones',
    icon: <UpdateIcon />,
  },
  {
    value: 'merge' as const,
    label: 'Merge',
    description: 'Combine duplicate entries based on merge rules',
    icon: <MergeIcon />,
  },
  {
    value: 'skip' as const,
    label: 'Skip',
    description: 'Skip duplicate entries, keeping only the first occurrence',
    icon: <SkipIcon />,
  },
  {
    value: 'custom' as const,
    label: 'Custom Function',
    description: 'Use a custom JavaScript function to resolve duplicates',
    icon: <FunctionsIcon />,
  },
];

export const DuplicateResolutionStep: React.FC<DuplicateResolutionStepProps> = ({
  data,
  onUpdate,
  onValidationChange,
}) => {
  const [strategy, setStrategy] = useState<DuplicateResolutionStrategy['strategy']>(
    data.duplicateResolution?.strategy || 'ignore'
  );
  const [customFunction, setCustomFunction] = useState<string>(
    data.duplicateResolution?.customFunction || ''
  );
  const [mergeProperties, setMergeProperties] = useState<string>(
    data.duplicateResolution?.mergeProperties?.join(', ') || ''
  );
  const [enableDuplicateDetection, setEnableDuplicateDetection] = useState(true);
  const [customFunctionError, setCustomFunctionError] = useState<string>('');

  // Update parent data when local state changes
  useEffect(() => {
    const duplicateResolution: DuplicateResolutionStrategy = {
      strategy,
      customFunction: strategy === 'custom' ? customFunction : undefined,
      mergeProperties: strategy === 'merge' && mergeProperties 
        ? mergeProperties.split(',').map(p => p.trim()).filter(p => p)
        : undefined,
    };
    
    onUpdate({ duplicateResolution });
  }, [strategy, customFunction, mergeProperties, onUpdate]);

  // Validation
  useEffect(() => {
    let isValid = true;
    
    if (strategy === 'custom') {
      if (!customFunction.trim()) {
        isValid = false;
        setCustomFunctionError('Custom function is required');
      } else {
        // Basic validation of JavaScript function syntax
        try {
          // Try to check if it's valid JavaScript (basic check)
          new Function(customFunction);
          setCustomFunctionError('');
        } catch (error) {
          isValid = false;
          setCustomFunctionError('Invalid JavaScript syntax');
        }
      }
    } else {
      setCustomFunctionError('');
    }
    
    onValidationChange(isValid);
  }, [strategy, customFunction, onValidationChange]);

  const handleStrategyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStrategy(event.target.value as DuplicateResolutionStrategy['strategy']);
  };

  const handleCustomFunctionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomFunction(event.target.value);
  };

  const handleMergePropertiesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMergeProperties(event.target.value);
  };

  const renderStrategyDetails = () => {
    switch (strategy) {
      case 'merge':
        return (
          <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Merge Configuration
            </Typography>
            <TextField
              fullWidth
              label="Properties to Merge (comma-separated)"
              value={mergeProperties}
              onChange={handleMergePropertiesChange}
              placeholder="price, quantity, tags"
              helperText="Specify which properties should be merged when duplicates are found"
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Merge behavior by data type:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Numbers"
                    secondary="Sum values by default"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Arrays"
                    secondary="Concatenate and remove duplicates"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Objects"
                    secondary="Deep merge with last-wins for conflicts"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Strings"
                    secondary="Keep the last value"
                  />
                </ListItem>
              </List>
            </Alert>
          </Paper>
        );

      case 'custom':
        return (
          <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Custom Resolution Function
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              label="JavaScript Function"
              value={customFunction}
              onChange={handleCustomFunctionChange}
              error={!!customFunctionError}
              helperText={customFunctionError || 'Write a function that receives (existing, duplicate) and returns the resolved value'}
              placeholder={`function resolveDuplicate(existing, duplicate) {
  // Example: Keep the record with higher priority
  if (duplicate.priority > existing.priority) {
    return duplicate;
  }
  return existing;
}`}
              sx={{ fontFamily: 'monospace' }}
            />
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                The function must:
                <ul>
                  <li>Accept two parameters: existing record and duplicate record</li>
                  <li>Return the resolved record</li>
                  <li>Handle edge cases (null values, missing properties)</li>
                </ul>
              </Typography>
            </Alert>
          </Paper>
        );

      case 'overwrite':
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              When duplicates are detected, the newer record will completely replace the existing one.
              This is useful when you trust the latest data source more than previous ones.
            </Typography>
          </Alert>
        );

      case 'skip':
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              When duplicates are detected, they will be skipped and only the first occurrence will be kept.
              This is useful when you want to preserve the original data without modifications.
            </Typography>
          </Alert>
        );

      case 'ignore':
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              All records will be kept, including duplicates. No deduplication will be performed.
              This may result in multiple entries with the same key values.
            </Typography>
          </Alert>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Duplicate Resolution Strategy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure how duplicate records should be handled during property mapping.
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={enableDuplicateDetection}
            onChange={(e) => setEnableDuplicateDetection(e.target.checked)}
          />
        }
        label="Enable duplicate detection"
        sx={{ mb: 3 }}
      />

      {enableDuplicateDetection && (
        <>
          <FormControl component="fieldset">
            <FormLabel component="legend">Resolution Strategy</FormLabel>
            <RadioGroup
              value={strategy}
              onChange={handleStrategyChange}
              sx={{ mt: 2 }}
            >
              {RESOLUTION_STRATEGIES.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {option.icon}
                      <Box>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ mb: 2 }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {renderStrategyDetails()}

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Duplicate Detection Keys
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Records are considered duplicates when these key properties match:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {data.mappingRules?.slice(0, 5).map((rule) => (
              <Chip
                key={rule.id}
                label={rule.targetProperty}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
            {(data.mappingRules?.length || 0) > 5 && (
              <Chip
                label={`+${(data.mappingRules?.length || 0) - 5} more`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          {(!data.mappingRules || data.mappingRules.length === 0) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No mapping rules defined yet. Complete the Property Mapping step to configure duplicate detection keys.
            </Alert>
          )}
        </>
      )}

      {!enableDuplicateDetection && (
        <Alert severity="info">
          <Typography variant="body2">
            Duplicate detection is disabled. All records will be processed without checking for duplicates.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};