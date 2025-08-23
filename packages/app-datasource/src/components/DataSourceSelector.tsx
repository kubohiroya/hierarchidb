/**
 * @fileoverview DataSourceSelector - Reusable data source selection component
 * @module @hierarchidb/ui-datasource/components
 */

import React, { useMemo } from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Stack,
  Link,
} from '@mui/material';
import {
  Public as PublicIcon,
  Layers as LayersIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { 
  DataSourceName, 
  DataSourceInfo,
  DataSourceConfigs,
  getLicenseColor,
  getLicenseLimitations,
} from '../types/DataSource';

export interface DataSourceSelectorProps {
  /**
   * Currently selected data source
   */
  selectedDataSource?: DataSourceName;
  
  /**
   * Available data sources to choose from
   * If not provided, uses all available data sources
   */
  availableDataSources?: DataSourceName[];
  
  /**
   * Filter by category
   */
  category?: 'geographic' | 'location' | 'route';
  
  /**
   * Additional information for each data source (e.g., country count)
   */
  dataSourceInfo?: Partial<Record<DataSourceName, Partial<DataSourceInfo>>>;
  
  /**
   * Layout configuration
   */
  layout?: {
    columns?: 1 | 2 | 3 | 4;
    minCardHeight?: number;
  };
  
  /**
   * Callback when data source is selected
   */
  onDataSourceChange: (dataSource: DataSourceName) => void;
  
  /**
   * Show additional details
   */
  showDetails?: {
    adminLevels?: boolean;
    countryCount?: boolean;
    limitations?: boolean;
    website?: boolean;
  };
}

/**
 * Reusable data source selection component
 * Used in Shape, Location, and Route plugins
 */
export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  selectedDataSource,
  availableDataSources,
  category,
  dataSourceInfo = {},
  layout = { columns: 2, minCardHeight: 200 },
  onDataSourceChange,
  showDetails = {
    adminLevels: true,
    countryCount: true,
    limitations: true,
    website: true,
  },
}) => {
  // Filter available data sources
  const filteredDataSources = useMemo(() => {
    let sources = availableDataSources || Object.keys(DataSourceConfigs) as DataSourceName[];
    
    if (category) {
      sources = sources.filter(name => DataSourceConfigs[name].category === category);
    }
    
    return sources;
  }, [availableDataSources, category]);

  // Build enhanced data source info
  const enhancedDataSources = useMemo(() => {
    return filteredDataSources.map(name => {
      const config = DataSourceConfigs[name];
      const additional = dataSourceInfo[name] || {};
      const limitations = additional.limitations || getLicenseLimitations(config.licenseType);
      
      return {
        ...config,
        ...additional,
        limitations,
      } as DataSourceInfo;
    });
  }, [filteredDataSources, dataSourceInfo]);

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 2 }}>
      <FormControl fullWidth>
        <RadioGroup
          name="dataSourceName"
          value={selectedDataSource || ''}
          onChange={(e) => onDataSourceChange(e.target.value as DataSourceName)}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
            gap: 2,
            '@media (max-width: 900px)': {
              gridTemplateColumns: '1fr',
            },
          }}
        >
          {enhancedDataSources.map((info) => {
            const isSelected = selectedDataSource === info.name;
            
            return (
              <FormControlLabel
                key={info.name}
                value={info.name}
                control={
                  <Radio
                    value={info.name}
                    id={info.name}
                    checked={isSelected}
                  />
                }
                label={
                  <Box
                    aria-labelledby={info.name}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        padding: 2,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        height: '100%',
                        minHeight: layout.minCardHeight,
                        border: '1px solid',
                        borderRadius: 1,
                        backgroundColor: isSelected 
                          ? (theme) => theme.palette.mode === 'dark' 
                            ? 'rgba(144, 202, 249, 0.08)' 
                            : '#e5e5f5'
                          : 'transparent',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        '&:hover': {
                          backgroundColor: isSelected 
                            ? (theme) => theme.palette.mode === 'dark'
                              ? 'rgba(144, 202, 249, 0.12)'
                              : '#e5e5f5'
                            : 'action.hover',
                        },
                      }}
                    >
                      {/* Header with title and license */}
                      <Stack direction="row" justifyContent="space-between" width="100%">
                        <Typography variant="h6" fontWeight="bold">
                          {info.displayName}
                        </Typography>
                        <Chip 
                          label={info.license} 
                          size="small" 
                          color={getLicenseColor(info.licenseType)}
                          variant="outlined"
                        />
                      </Stack>
                      
                      {/* Description */}
                      <Typography variant="body2" color="text.secondary">
                        {info.description}
                      </Typography>
                      
                      {/* Stats row */}
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        {showDetails.countryCount && info.countryCount && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <PublicIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {info.countryCount} countries
                            </Typography>
                          </Stack>
                        )}
                        {showDetails.adminLevels && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <LayersIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              Admin levels: 0-{info.maxAdminLevel}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                      
                      {/* Features (if provided) */}
                      {info.features && info.features.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {info.features.map((feature) => (
                            <Chip
                              key={feature}
                              label={feature}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Stack>
                      )}
                      
                      {/* Limitations */}
                      {showDetails.limitations && info.limitations && info.limitations.length > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="flex-start">
                          <InfoIcon fontSize="small" color="warning" sx={{ mt: 0.2 }} />
                          <Box>
                            {info.limitations.map((limitation) => (
                              <Typography key={limitation} variant="caption" color="warning.main" display="block">
                                • {limitation}
                              </Typography>
                            ))}
                          </Box>
                        </Stack>
                      )}
                    </Box>
                    
                    {/* Website link */}
                    {showDetails.website && (
                      <Link
                        href={info.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          mt: 1,
                          textAlign: 'center',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {info.website}
                      </Link>
                    )}
                  </Box>
                }
                sx={{
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  alignItems: 'flex-start',
                  '& .MuiFormControlLabel-label': {
                    width: 'calc(100% - 42px)', // Account for radio button width
                    height: '100%',
                  },
                }}
              />
            );
          })}
        </RadioGroup>
      </FormControl>
    </Box>
  );
};