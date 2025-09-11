import React, { useCallback, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import type { FolderEntity } from '@hierarchidb/folder-plugin';
import type { DialogStepDefinition } from '@hierarchidb/common-type';
import { BaseFolderPlugin } from '@hierarchidb/folder-plugin';

/**
 * Styler extension data
 */
export interface StylerData {
  styleType?: 'choropleth' | 'heatmap' | 'points' | 'lines';
  dataSource?: string;
  colorScheme?: string;
  minValue?: number;
  maxValue?: number;
  opacity?: number;
  strokeWidth?: number;
  categories?: string[];
}

/**
 * Styler configuration step component
 */
const StylerConfigStep: React.FC<{
  data: StylerData;
  onChange: (data: StylerData) => void;
  errors?: string[];
  isSubmitting?: boolean;
}> = ({ data, onChange, errors, isSubmitting }) => {
  const handleStyleTypeChange = useCallback(
    (e: any) => {
      onChange({ ...data, styleType: e.target.value });
    },
    [data, onChange],
  );

  const handleDataSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, dataSource: e.target.value });
    },
    [data, onChange],
  );

  const handleColorSchemeChange = useCallback(
    (e: any) => {
      onChange({ ...data, colorScheme: e.target.value });
    },
    [data, onChange],
  );

  const handleMinValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onChange({ ...data, minValue: isNaN(value) ? undefined : value });
    },
    [data, onChange],
  );

  const handleMaxValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onChange({ ...data, maxValue: isNaN(value) ? undefined : value });
    },
    [data, onChange],
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onChange({ ...data, opacity: isNaN(value) ? undefined : value });
    },
    [data, onChange],
  );

  const styleTypeError = errors?.find(e => e.includes('style type'));
  const dataSourceError = errors?.find(e => e.includes('data source'));
  const rangeError = errors?.find(e => e.includes('range'));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Configure map visualization style
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth error={!!styleTypeError} disabled={isSubmitting}>
          <InputLabel>Style Type</InputLabel>
          <Select
            value={data.styleType || ''}
            onChange={handleStyleTypeChange}
            label="Style Type"
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="choropleth">Choropleth Map</MenuItem>
            <MenuItem value="heatmap">Heat Map</MenuItem>
            <MenuItem value="points">Point Markers</MenuItem>
            <MenuItem value="lines">Line Features</MenuItem>
          </Select>
          {styleTypeError && <FormHelperText>{styleTypeError}</FormHelperText>}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Data Source"
          value={data.dataSource || ''}
          onChange={handleDataSourceChange}
          error={!!dataSourceError}
          helperText={dataSourceError || 'CSV file or API endpoint'}
          disabled={isSubmitting}
          placeholder="e.g., data.csv or https://api.example.com/data"
        />
      </Grid>

      {data.styleType && (
        <>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={isSubmitting}>
              <InputLabel>Color Scheme</InputLabel>
              <Select
                value={data.colorScheme || 'blues'}
                onChange={handleColorSchemeChange}
                label="Color Scheme"
              >
                <MenuItem value="blues">Blues</MenuItem>
                <MenuItem value="reds">Reds</MenuItem>
                <MenuItem value="greens">Greens</MenuItem>
                <MenuItem value="purples">Purples</MenuItem>
                <MenuItem value="viridis">Viridis</MenuItem>
                <MenuItem value="plasma">Plasma</MenuItem>
                <MenuItem value="rainbow">Rainbow</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Opacity"
              type="number"
              value={data.opacity || 0.7}
              onChange={handleOpacityChange}
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              disabled={isSubmitting}
              helperText="0 (transparent) to 1 (opaque)"
            />
          </Grid>

          {(data.styleType === 'choropleth' || data.styleType === 'heatmap') && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Min Value"
                  type="number"
                  value={data.minValue || ''}
                  onChange={handleMinValueChange}
                  error={!!rangeError}
                  disabled={isSubmitting}
                  placeholder="Minimum data value"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Value"
                  type="number"
                  value={data.maxValue || ''}
                  onChange={handleMaxValueChange}
                  error={!!rangeError}
                  helperText={rangeError}
                  disabled={isSubmitting}
                  placeholder="Maximum data value"
                />
              </Grid>
            </>
          )}
        </>
      )}
    </Grid>
  );
};

/**
 * Category mapping step component
 */
const CategoryMappingStep: React.FC<{
  data: { categories?: string[] };
  onChange: (data: { categories?: string[] }) => void;
  errors?: string[];
  isSubmitting?: boolean;
}> = ({ data, onChange, errors, isSubmitting }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddCategory = useCallback(() => {
    if (inputValue.trim()) {
      const newCategories = [...(data.categories || []), inputValue.trim()];
      onChange({ ...data, categories: newCategories });
      setInputValue('');
    }
  }, [inputValue, data, onChange]);

  const handleRemoveCategory = useCallback(
    (index: number) => {
      const newCategories = (data.categories || []).filter((_, i) => i !== index);
      onChange({ ...data, categories: newCategories });
    },
    [data, onChange],
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCategory();
      }
    },
    [handleAddCategory],
  );

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Define data categories for mapping
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Add Category"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSubmitting}
          placeholder="Type category name and press Enter"
          helperText="Categories will be mapped to different colors/styles"
        />
      </Grid>

      {data.categories && data.categories.length > 0 && (
        <Grid item xs={12}>
          <Typography variant="body2" gutterBottom>
            Categories ({data.categories.length}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {data.categories.map((category, index) => (
              <Chip
                key={index}
                label={category}
                onDelete={isSubmitting ? undefined : () => handleRemoveCategory(index)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        </Grid>
      )}

      {errors?.length && (
        <Grid item xs={12}>
          <Typography color="error" variant="caption">
            {errors.join(', ')}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

/**
 * Styler extension for the Folder plugin
 */
export class StylerFolderExtension extends BaseFolderPlugin {
  readonly pluginId = 'styler-plugin-folder-plugin-extension';
  readonly pluginName = 'Styler for Folders';
  readonly pluginDescription = 'Adds map visualization capabilities to folders';
  readonly pluginVersion = '1.0.0';

  protected getCreateDialogSteps(): DialogStepDefinition[] {
    return [
      this.createDialogStep<StylerData>({
        id: 'style-config',
        label: 'Map Style',
        description: 'Configure map visualization style',
        component: StylerConfigStep,
        validation: {
          validate: async (data: StylerData) => {
            const errors: string[] = [];

            if (data.styleType && !data.dataSource) {
              errors.push('Data source is required when style type is selected');
            }

            if (data.minValue !== undefined && data.maxValue !== undefined) {
              if (data.minValue >= data.maxValue) {
                errors.push('Min value must be less than max value');
              }
            }

            return {
              isValid: errors.length === 0,
              errors,
            };
          },
          canProceed: (data: StylerData) => {
            // Can proceed if no style type selected, or if both style type and data source are provided
            return !data.styleType || !!data.dataSource;
          },
        },
        required: false,
        order: 10,
      }),
      this.createDialogStep<{ categories?: string[] }>({
        id: 'category-mapping',
        label: 'Categories',
        description: 'Define data categories',
        component: CategoryMappingStep,
        validation: {
          validate: async (data: { categories?: string[] }) => {
            const errors: string[] = [];

            if (data.categories && data.categories.length > 50) {
              errors.push('Maximum 50 categories allowed');
            }

            // Check for duplicates
            if (data.categories) {
              const unique = new Set(data.categories);
              if (unique.size !== data.categories.length) {
                errors.push('Duplicate categories found');
              }
            }

            return {
              isValid: errors.length === 0,
              errors,
            };
          },
        },
        required: false,
        order: 20,
        dependsOn: ['styler-plugin-folder-plugin-extension-style-config'],
      }),
    ];
  }

  protected getEditDialogSteps(): DialogStepDefinition[] {
    // Same steps for edit mode
    return this.getCreateDialogSteps();
  }

  protected getStepStateEvaluator() {
    return {
      getFilledSteps: (data: any, stepNumbers?: number[]) => {
        const steps = stepNumbers || [];
        return steps.map((num) => {
          // style-config (order 10):
          if (num === 10) {
            // If styleType is selected, dataSource must be present and min<max when both provided
            if (!data?.styleType) return true; // not selecting style keeps it optional/filled
            if (!data?.dataSource) return false;
            if (data.minValue !== undefined && data.maxValue !== undefined) {
              return data.minValue < data.maxValue;
            }
            return true;
          }
          // category-mapping (order 20): duplicates not allowed, <=50 items
          if (num === 20) {
            const cats: string[] | undefined = data?.categories;
            if (!cats) return true; // optional
            if (cats.length > 50) return false;
            const unique = new Set(cats);
            return unique.size === cats.length;
          }
          // Other steps unaffected
          return true;
        });
      },
      getNavigableSteps: (data: any, stepNumbers?: number[]) => {
        const steps = stepNumbers || [];
        // Allow navigation to style-config always; category-mapping requires style-config decision
        const hasStyleDecision = !data?.styleType || !!data?.dataSource;
        return steps.map((num, _idx) => {
          if (num === 10) return true;
          if (num === 20) return hasStyleDecision;
          return true;
        });
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: any) => {
      // If styleType selected, enforce dataSource present and min<max (when both present)
      if (data?.styleType) {
        if (!data?.dataSource) return false;
        if (data.minValue !== undefined && data.maxValue !== undefined) {
          if (!(data.minValue < data.maxValue)) return false;
        }
      }
      // Categories constraint (if provided): no duplicates and <= 50 items
      if (Array.isArray(data?.categories)) {
        const cats: string[] = data.categories;
        if (cats.length > 50) return false;
        const unique = new Set(cats);
        if (unique.size !== cats.length) return false;
      }
      return true;
    };
  }

  protected transformDialogData(data: Record<string, any>): Record<string, any> {
    // Transform the data to store Styler configuration
    const stylerConfig: any = {};

    if (data.styleType) {
      stylerConfig.styleType = data.styleType;
      stylerConfig.dataSource = data.dataSource;
      stylerConfig.colorScheme = data.colorScheme || 'blues';
      stylerConfig.opacity = data.opacity || 0.7;

      if (data.minValue !== undefined) {
        stylerConfig.minValue = data.minValue;
      }
      if (data.maxValue !== undefined) {
        stylerConfig.maxValue = data.maxValue;
      }
      if (data.categories?.length) {
        stylerConfig.categories = data.categories;
      }
    }

    return {
      ...data,
      stylerConfig: Object.keys(stylerConfig).length > 0 ? stylerConfig : undefined,
    };
  }

  protected getAdditionalEntityFields(): string[] {
    return ['stylerConfig'];
  }

  protected async validateEntity(entity: Partial<FolderEntity>): Promise<string[]> {
    const errors: string[] = [];
    const stylerConfig = (entity as any).stylerConfig;

    if (stylerConfig) {
      if (!stylerConfig.styleType) {
        errors.push('Styler configuration is missing style type');
      }
      if (!stylerConfig.dataSource) {
        errors.push('Styler configuration is missing data source');
      }
    }

    return errors;
  }

  protected async afterCreate(node: any, entity: FolderEntity): Promise<void> {
    const stylerConfig = (entity as any).stylerConfig;
    if (stylerConfig) {
      console.log(`Created folder "${entity.name}" with Styler configuration:`, stylerConfig);
    }
  }

  protected async afterUpdate(node: any, entity: FolderEntity): Promise<void> {
    const stylerConfig = (entity as any).stylerConfig;
    if (stylerConfig) {
      console.log(`Updated folder "${entity.name}" Styler configuration:`, stylerConfig);
    }
  }
}

// Create and export singleton instance
export const stylerFolderExtension = new StylerFolderExtension();

export async function initializeStylerFolderExtension() {
  await stylerFolderExtension.initialize();
}
