import React, { useCallback, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import type { FolderEntity } from '@hierarchidb/plugins-folder-plugin';
import type { DialogStepDefinition, DraftPeerEntity } from '@hierarchidb/common-type';
import { BaseDialogPlugin } from '@hierarchidb/plugins-base-plugin';

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
  stylerConfig?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Styler configuration step component
 */
type StyleTypeValue = NonNullable<StylerData['styleType']>;

const isStyleTypeValue = (value: string): value is StyleTypeValue => {
  return value === 'choropleth' || value === 'heatmap' || value === 'points' || value === 'lines';
};

type StylerDialogDraft = DraftPeerEntity<StylerData> & Record<string, unknown>;
type StylerStepProps = React.ComponentProps<typeof StylerConfigStep>;
type StylerCategoryStepProps = React.ComponentProps<typeof CategoryMappingStep>;

const StylerConfigStep: React.FC<{
  data: StylerDialogDraft;
  onChange: (data: StylerDialogDraft) => void;
  errors?: string[];
  isSubmitting?: boolean;
}> = ({ data, onChange, errors, isSubmitting }) => {
  const handleStyleTypeChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      if (value === '') {
        onChange({ ...data, styleType: undefined });
        return;
      }
      if (isStyleTypeValue(value)) {
        onChange({ ...data, styleType: value });
      }
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
    (event: SelectChangeEvent<string>) => {
      onChange({ ...data, colorScheme: event.target.value as StylerData['colorScheme'] });
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
  data: StylerDialogDraft;
  onChange: (data: StylerDialogDraft) => void;
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
 * Styler dialog extension for node configuration
 */
export class StylerDialogExtension extends BaseDialogPlugin<StylerDialogDraft> {
  readonly pluginId = 'styler-plugin-folder-plugin-extension';
  readonly pluginName = 'Styler Dialog Extension';
  readonly pluginDescription = 'Adds map visualization capabilities to the shared node dialog';
  readonly pluginVersion = '1.0.0';

  protected getCreateDialogSteps(): DialogStepDefinition[] {
    return [
      this.createDialogStep<StylerStepProps>({
        id: 'style-config',
        label: 'Map Style',
        component: StylerConfigStep as ComponentType<StylerStepProps>,
        validation: {
          validate: async ({ data }: StylerStepProps) => {
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
          canProceed: ({ data }: StylerStepProps) => {
            // Can proceed if no style type selected, or if both style type and data source are provided
            return !data.styleType || !!data.dataSource;
          },
        },
        required: false,
        order: 10,
      }),
      this.createDialogStep<StylerCategoryStepProps>({
        id: 'category-mapping',
        label: 'Categories',
        component: CategoryMappingStep as ComponentType<StylerCategoryStepProps>,
        validation: {
          validate: async ({ data }: StylerCategoryStepProps) => {
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
      }),
    ];
  }

  protected getEditDialogSteps(): DialogStepDefinition[] {
    // Same steps for edit mode
    return this.getCreateDialogSteps();
  }

  protected getStepStateEvaluator() {
    const evaluateValidated = (
      data: StylerDialogDraft,
      stepNumbers?: ReadonlyArray<number>,
    ) => {
      const steps = stepNumbers ? [...stepNumbers] : [];
      return steps.map((num) => {
        if (num === 10) {
          if (!data?.styleType) return true;
          if (!data?.dataSource) return false;
          if (data.minValue !== undefined && data.maxValue !== undefined) {
            return data.minValue < data.maxValue;
          }
          return true;
        }
        if (num === 20) {
          const cats: string[] | undefined = data?.categories;
          if (!cats) return true;
          if (cats.length > 50) return false;
          const unique = new Set(cats);
          return unique.size === cats.length;
        }
        return true;
      });
    };

    const evaluateEnabled = (
      data: StylerDialogDraft,
      stepNumbers?: ReadonlyArray<number>,
    ) => {
      const steps = stepNumbers ? [...stepNumbers] : [];
      const hasStyleDecision = !data?.styleType || !!data?.dataSource;
      return steps.map((num) => {
        if (num === 10) return true;
        if (num === 20) return hasStyleDecision;
        return true;
      });
    };

    return {
      getEnabledSteps: evaluateEnabled,
      getValidatedSteps: evaluateValidated,
    };
  }

  protected getSubmitEligibility() {
    return (data: StylerDialogDraft) => {
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

  protected transformDialogData(data: StylerDialogDraft): StylerDialogDraft {
    // Transform the data to store Styler configuration
    const stylerConfig: Record<string, unknown> = {};

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
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        stylerConfig.categories = [...data.categories];
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
    const candidate = (entity as { stylerConfig?: unknown }).stylerConfig;
    const stylerConfig = isRecord(candidate) ? candidate : undefined;

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

  protected async afterCreate(_node: any, entity: FolderEntity): Promise<void> {
    const candidate = (entity as { stylerConfig?: unknown }).stylerConfig;
    const stylerConfig = isRecord(candidate) ? candidate : undefined;
    if (stylerConfig) {
      console.log(`Created folder "${entity.name}" with Styler configuration:`, stylerConfig);
    }
  }

  protected async afterUpdate(_node: any, entity: FolderEntity): Promise<void> {
    const candidate = (entity as { stylerConfig?: unknown }).stylerConfig;
    const stylerConfig = isRecord(candidate) ? candidate : undefined;
    if (stylerConfig) {
      console.log(`Updated folder "${entity.name}" Styler configuration:`, stylerConfig);
    }
  }
}

// Create and export singleton instance
export const stylerDialogExtension = new StylerDialogExtension();

export async function initializeStylerDialogExtension() {
  await stylerDialogExtension.initialize();
}
