/**
 * Sample Plugin Provider
 * Example implementation of a plugin step provider
 */

import { Box, TextField, Typography } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import type { PluginStepProvider, StepComponentProps } from '@hierarchidb/plugin-base';
import type { DialogStep } from '@hierarchidb/ui-dialog';

/**
 * Sample configuration step component
 */
const ConfigurationStep: React.FC<StepComponentProps> = ({
                                                           data,
                                                           onChange,
                                                           setValid,
                                                         }) => {
  const handleChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });

    // Simple validation
    const isValid = value && value.toString().trim().length > 0;
    setValid(isValid);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Configure the additional settings for this node.
      </Typography>

      <TextField
        label="Setting 1"
        value={data?.setting1 || ''}
        onChange={(e) => handleChange('setting1', e.target.value)}
        fullWidth
        helperText="Enter a value for setting 1"
      />

      <TextField
        label="Setting 2"
        value={data?.setting2 || ''}
        onChange={(e) => handleChange('setting2', e.target.value)}
        fullWidth
        multiline
        rows={3}
        helperText="Enter a value for setting 2"
      />
    </Box>
  );
};

/**
 * Sample review step component
 */
const ReviewStep: React.FC<StepComponentProps> = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">Review Configuration</Typography>

      <Typography variant="body2" color="text.secondary">
        Please review your configuration before saving.
      </Typography>

      <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle2">Setting 1:</Typography>
        <Typography>{data?.setting1 || 'Not set'}</Typography>
      </Box>

      <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle2">Setting 2:</Typography>
        <Typography>{data?.setting2 || 'Not set'}</Typography>
      </Box>
    </Box>
  );
};

/**
 * Sample Plugin Step Provider
 */
export class SamplePluginProvider implements PluginStepProvider {
  nodeType = 'sample';

  getCreateSteps(): DialogStep[] {
    return [
      {
        id: 'configuration',
        label: 'Configuration',
        icon: <FolderIcon />,
        component: (
          <ConfigurationStep
            mode="create"
            data={{}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        validate: () => true,
        capabilities: {
          canNavigateTo: (_fromStep, _data) => {
            // Can always navigate to configuration step
            return true;
          },
          canProceedToNext: (data) => {
            // Can proceed if required fields are filled
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canBackToPrevious: (_data) => {
            // Can always go back from configuration (though it's the first step)
            return true;
          },
          canSave: (data) => {
            // Can save if all required fields are filled
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canStartBatch: (_data) => {
            // Batch is not available from configuration step
            return false;
          },
        },
      },
      {
        id: 'batch-config',
        label: 'Batch Configuration',
        component: (
          <ConfigurationStep
            mode="create"
            data={{}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        optional: true,
        capabilities: {
          canNavigateTo: (_fromStep, _data) => {
            // Can navigate if configuration is complete
            return !!(_data?.setting1 && _data?.setting1.trim());
          },
          canProceedToNext: (data) => {
            // Can proceed if batch settings are valid
            return !!(data?.batchSize && data?.batchSize > 0);
          },
          canBackToPrevious: (data) => {
            // Can go back unless batch is currently running
            return !data?.batchRunning;
          },
          canSave: (_data) => {
            // Can save from batch step
            return true;
          },
          canStartBatch: (data) => {
            // Can start batch if batch configuration is valid
            return !!(data?.batchSize && data?.batchSize > 0 && data?.batchSize <= 1000);
          },
        },
      },
      {
        id: 'review',
        label: 'Review',
        component: (
          <ReviewStep
            mode="create"
            data={{}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        optional: true,
        capabilities: {
          canNavigateTo: (_fromStep, _data) => {
            // Can navigate to review if configuration is complete
            return !!(_data?.setting1 && _data?.setting1.trim());
          },
          canProceedToNext: () => false, // This is the last step
          canBackToPrevious: (data) => {
            // Can go back from review unless saving is in progress
            return !data?.saving;
          },
          canSave: (_data) => {
            // Can always save from review
            return true;
          },
          canStartBatch: (data) => {
            // Can start batch from review if batch is configured
            return !!(data?.batchSize && data?.batchSize > 0 && data?.batchSize <= 1000);
          },
        },
      },
    ];
  }

  getEditSteps(nodeId: string, data?: any): DialogStep[] {
    return [
      {
        id: 'configuration',
        label: 'Configuration',
        icon: <FolderIcon />,
        component: (
          <ConfigurationStep
            mode="edit"
            nodeId={nodeId}
            data={data || {}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        validate: () => true,
        capabilities: {
          canNavigateTo: () => true,
          canProceedToNext: (data) => {
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canBackToPrevious: () => true,
          canSave: (data) => {
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canStartBatch: () => false,
        },
      },
      {
        id: 'batch-config',
        label: 'Batch Update',
        component: (
          <ConfigurationStep
            mode="edit"
            nodeId={nodeId}
            data={data || {}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        optional: true,
        capabilities: {
          canNavigateTo: (_fromStep, _data) => {
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canProceedToNext: (data) => {
            return !!(data?.batchSize && data?.batchSize > 0);
          },
          canBackToPrevious: () => true,
          canSave: () => true,
          canStartBatch: (data) => {
            // Batch update is available when batch is properly configured
            return !!(data?.batchSize &&
              data?.batchSize > 0 &&
              data?.batchSize <= 1000 &&
              data?.targetNodes?.length > 0);
          },
        },
      },
      {
        id: 'review',
        label: 'Review',
        component: (
          <ReviewStep
            mode="edit"
            nodeId={nodeId}
            data={data || {}}
            onChange={() => {
            }}
            setValid={() => {
            }}
            setError={() => {
            }}
          />
        ),
        optional: true,
        capabilities: {
          canNavigateTo: (_fromStep, _data) => {
            return !!(data?.setting1 && data?.setting1.trim());
          },
          canProceedToNext: () => false,
          canBackToPrevious: () => true,
          canSave: () => true,
          canStartBatch: (data) => {
            return !!(data?.batchSize &&
              data?.batchSize > 0 &&
              data?.batchSize <= 1000 &&
              data?.targetNodes?.length > 0);
          },
        },
      },
    ];
  }

  async validateAccess(nodeId?: string): Promise<boolean> {
    // Example: Check if user has access to this node
    console.log('Validating access for node:', nodeId);

    // In a real implementation, this would check permissions
    // For example, check if the user owns the node or has edit permissions
    return true;
  }
}

/**
 * Register the sample provider
 */
export function registerSampleProvider() {
  import('@hierarchidb/plugin-base').then(({ PluginStepRegistry }) => {
    const registry = PluginStepRegistry.getInstance();
    const provider = new SamplePluginProvider();
    registry.register(provider);
    console.log('Sample plugin provider registered');
  });
}
