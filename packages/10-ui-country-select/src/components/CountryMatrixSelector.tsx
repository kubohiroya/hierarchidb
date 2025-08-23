/**
 * @fileoverview CountryMatrixSelector - Main component for country and matrix selection
 * @module @hierarchidb/ui-country-select/components
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
  ClearAll as ClearAllIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';

import { Virtuoso } from 'react-virtuoso';

import type { Country, CountryFilter, ContinentCode } from '../types/Country';
import type { MatrixConfig, MatrixSelection } from '../types/MatrixColumn';
import { CONTINENTS } from '../types/Country';

export interface CountryMatrixSelectorProps {
  /** Available countries to select from */
  countries: Country[];
  /** Matrix configuration with columns */
  matrixConfig: MatrixConfig;
  /** Current selections state */
  selections: MatrixSelection[];
  /** Callback when selections change */
  onSelectionsChange: (selections: MatrixSelection[]) => void;
  /** Initial filter state */
  initialFilter?: CountryFilter;
  /** Component height (defaults to 600px) */
  height?: number;
  /** Whether to show bulk selection tools */
  showBulkTools?: boolean;
  /** Whether to show country information columns */
  showCountryInfo?: boolean;
  /** Custom row height for virtualization */
  rowHeight?: number;
}

// Type-safe Virtuoso component wrapper
const VirtuosoComponent = Virtuoso as React.FC<{
  style?: React.CSSProperties;
  totalCount: number;
  itemContent: (index: number) => React.ReactElement;
  overscan?: number;
}>;

interface TableRowData {
  country: Country;
  selections: Record<string, boolean>;
}

/**
 * CountryMatrixSelector - Virtualized table for country and matrix selection
 * 
 * Features:
 * - Virtualized scrolling for performance with large datasets
 * - Flexible matrix columns (admin levels, transport hubs, routes, etc.)
 * - Search and filtering capabilities
 * - Bulk selection operations
 * - Responsive design
 */
export const CountryMatrixSelector: React.FC<CountryMatrixSelectorProps> = ({
  countries,
  matrixConfig,
  selections,
  onSelectionsChange,
  initialFilter = {},
  height = 600,
  showBulkTools = true,
  showCountryInfo = true,
  rowHeight = 56,
}) => {
  const [filter, setFilter] = useState<CountryFilter>(initialFilter);
  const [showFilters, setShowFilters] = useState(false);

  // Convert selections array to lookup map
  const selectionsMap = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    selections.forEach(selection => {
      map.set(selection.countryCode, selection.selections);
    });
    return map;
  }, [selections]);

  // Filter countries based on current filter
  const filteredCountries = useMemo(() => {
    return countries.filter(country => {
      // Search query filter
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        if (!country.name.toLowerCase().includes(query) &&
            !(country.nativeName && country.nativeName.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Continent filter
      if (filter.continent && country.continent !== filter.continent) {
        return false;
      }

      // Population filters
      if (filter.minPopulation && (!country.population || country.population < filter.minPopulation)) {
        return false;
      }
      if (filter.maxPopulation && (!country.population || country.population > filter.maxPopulation)) {
        return false;
      }

      // Custom filter
      if (filter.customFilter && !filter.customFilter(country)) {
        return false;
      }

      return true;
    });
  }, [countries, filter]);

  // Prepare table data
  const tableData: TableRowData[] = useMemo(() => {
    return filteredCountries.map(country => ({
      country,
      selections: selectionsMap.get(country.code) || {},
    }));
  }, [filteredCountries, selectionsMap]);

  // Handle selection change
  const handleSelectionChange = useCallback((countryCode: string, columnId: string, selected: boolean) => {
    const newSelections = [...selections];
    const existingIndex = newSelections.findIndex(s => s.countryCode === countryCode);
    
    if (existingIndex >= 0) {
      const existing = newSelections[existingIndex];
      if (existing) {
        newSelections[existingIndex] = {
          countryCode: existing.countryCode,
          selections: {
            ...existing.selections,
            [columnId]: selected,
          },
        };
      }
    } else {
      newSelections.push({
        countryCode,
        selections: { [columnId]: selected },
      });
    }

    onSelectionsChange(newSelections);
  }, [selections, onSelectionsChange]);

  // Bulk selection handlers
  const handleSelectAll = useCallback(() => {
    const newSelections: MatrixSelection[] = filteredCountries.map(country => ({
      countryCode: country.code,
      selections: matrixConfig.columns.reduce((acc, col) => {
        acc[col.id] = true;
        return acc;
      }, {} as Record<string, boolean>),
    }));
    onSelectionsChange(newSelections);
  }, [filteredCountries, matrixConfig.columns, onSelectionsChange]);

  const handleClearAll = useCallback(() => {
    onSelectionsChange([]);
  }, [onSelectionsChange]);

  // Table header component
  const TableHeader = () => (
    <Box
      sx={{
        display: 'flex',
        backgroundColor: 'grey.100',
        borderBottom: 1,
        borderColor: 'divider',
        p: 1,
      }}
    >
      {/* Country column */}
      <Box sx={{ minWidth: 200, p: 1, fontWeight: 'bold' }}>
        Country
      </Box>
      
      {showCountryInfo && (
        <>
          <Box sx={{ minWidth: 100, p: 1, fontWeight: 'bold' }}>
            Continent
          </Box>
          <Box sx={{ minWidth: 120, p: 1, fontWeight: 'bold' }}>
            Population
          </Box>
        </>
      )}

      {/* Matrix columns */}
      {matrixConfig.columns.map(column => (
        <Box
          key={column.id}
          sx={{
            minWidth: column.width || 120,
            p: 1,
            fontWeight: 'bold',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
          }}
        >
          {column.label}
          {column.description && (
            <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
              {column.description}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );

  // Table row component
  const TableRow: React.FC<{ index: number; style?: React.CSSProperties }> = ({ index, style }) => {
    const rowData = tableData[index];
    if (!rowData) return null;

    const { country, selections: rowSelections } = rowData;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          p: 1,
          '&:hover': {
            backgroundColor: 'grey.50',
          },
        }}
        style={style}
      >
        {/* Country column */}
        <Box sx={{ minWidth: 200, p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {country.name}
          </Typography>
          {country.flag && (
            <Typography variant="body2">{country.flag}</Typography>
          )}
        </Box>

        {showCountryInfo && (
          <>
            <Box sx={{ minWidth: 100, p: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {country.continent}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 120, p: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {country.population ? country.population.toLocaleString() : 'N/A'}
              </Typography>
            </Box>
          </>
        )}

        {/* Matrix columns */}
        {matrixConfig.columns.map(column => (
          <Box
            key={column.id}
            sx={{
              minWidth: column.width || 120,
              p: 1,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Checkbox
              checked={rowSelections[column.id] || false}
              onChange={(e) => handleSelectionChange(country.code, column.id, e.target.checked)}
              size="small"
            />
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height }}>
      {/* Search and filter controls */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search countries..."
          value={filter.searchQuery || ''}
          onChange={(e) => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 200 }}
        />

        {showBulkTools && (
          <>
            <Button
              variant="outlined"
              startIcon={<SelectAllIcon />}
              onClick={handleSelectAll}
              size="small"
            >
              Select All
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearAllIcon />}
              onClick={handleClearAll}
              size="small"
            >
              Clear All
            </Button>
          </>
        )}

        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(!showFilters)}
          size="small"
        >
          Filters
        </Button>

        <Typography variant="body2" color="text.secondary">
          {filteredCountries.length} countries
        </Typography>
      </Box>

      {/* Advanced filters */}
      {showFilters && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Advanced Filters
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Continent</InputLabel>
              <Select
                value={filter.continent || ''}
                onChange={(e) => setFilter(prev => ({ 
                  ...prev, 
                  continent: e.target.value as ContinentCode || undefined 
                }))}
              >
                <MenuItem value="">All</MenuItem>
                {Object.entries(CONTINENTS).map(([code, continent]) => (
                  <MenuItem key={code} value={code}>
                    {continent.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Min Population (millions)"
              type="number"
              size="small"
              value={filter.minPopulation ? filter.minPopulation / 1000000 : ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                minPopulation: e.target.value ? Number(e.target.value) * 1000000 : undefined 
              }))}
              sx={{ width: 200 }}
            />

            <TextField
              label="Max Population (millions)"
              type="number"
              size="small"
              value={filter.maxPopulation ? filter.maxPopulation / 1000000 : ''}
              onChange={(e) => setFilter(prev => ({ 
                ...prev, 
                maxPopulation: e.target.value ? Number(e.target.value) * 1000000 : undefined 
              }))}
              sx={{ width: 200 }}
            />
          </Stack>
        </Paper>
      )}

      {/* Virtualized table */}
      <Paper sx={{ height: height - 120, overflow: 'hidden' }}>
        <TableHeader />
        <VirtuosoComponent
          style={{ height: height - 180 }} // Account for header and controls
          totalCount={tableData.length}
          itemContent={(index: number) => (
            <TableRow 
              index={index} 
              style={{ height: rowHeight, display: 'flex', alignItems: 'center' }} 
            />
          )}
          overscan={matrixConfig.virtualization?.overscan || 5}
        />
      </Paper>
    </Box>
  );
};