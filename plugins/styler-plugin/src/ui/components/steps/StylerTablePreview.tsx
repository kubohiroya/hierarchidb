/**
  * @file StylerTablePreview.tsx
 * @description Styler table preview with color visualization (Step 6)
 * :
 * : eria-cartograph
 * :
  */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  GridView as GridViewIcon,
  Palette as PaletteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
// import { VariableSizeList as List } from 'provider-window';
import type { StylerConfig } from '../../../common/types/stylerTypes.js';
import { valueToColor } from '../../../common/utils/colorUtils.js';

/**
  * :
  */
type SortDirection = 'asc' | 'desc' | null;

/**
  * :
  */
export interface StylerTablePreviewProps {
  data: Array<Record<string, any>>;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  config: StylerConfig;
  onColumnSelect?: (columnName: string, type: 'key' | 'value') => void;
  maxRows?: number;
  enableVirtualization?: boolean;
}

/**
  * :
  */
interface ColumnWidths {
  [key: string]: number;
}

/**
  * :
 * :
 * :
  */
const ResizableTableHeader: React.FC<{
  column: string;
  width: number;
  onResize: (column: string, width: number) => void;
  sortDirection?: SortDirection;
  onSort?: () => void;
  isKeyColumn?: boolean;
  isValueColumn?: boolean;
}> = ({
        column,
        width,
        onResize,
        sortDirection,
        onSort,
        isKeyColumn,
        isValueColumn,
      }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(width);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);
      onResize(column, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <TableCell
      sx={{
        position: 'relative',
        width,
        minWidth: width,
        maxWidth: width,
        borderRight: '1px solid',
        borderColor: 'divider',
        backgroundColor: isKeyColumn ? 'primary.50' : isValueColumn ? 'secondary.50' : undefined,
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <TableSortLabel
          active={sortDirection !== null}
          direction={sortDirection === 'desc' ? 'desc' : 'asc'}
          onClick={onSort}
        >
          <Typography variant="subtitle2" noWrap>
            {column}
          </Typography>
        </TableSortLabel>

        {(isKeyColumn || isValueColumn) && (
          <Chip
            size="small"
            label={isKeyColumn ? 'KEY' : 'VALUE'}
            color={isKeyColumn ? 'primary' : 'secondary'}
            sx={{ ml: 1, height: 20 }}
          />
        )}
      </Stack>

      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          backgroundColor: isResizing ? 'primary.main' : 'transparent',
          '&:hover': {
            backgroundColor: 'primary.light',
          },
        }}
      />
    </TableCell>
  );
};

/**
  * :
 * :
 * :
  */
const TableRowComponent: React.FC<{
  rowData: Record<string, any>;
  columns: string[];
  columnWidths: ColumnWidths;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  config: StylerConfig;
  showColorPreview: boolean;
}> = React.memo(({
                   rowData,
                   columns,
                   columnWidths,
                   selectedKeyColumn,
                   selectedValueColumn,
                   config,
                   showColorPreview,
                 }) => {
  const theme = useTheme();

  //  :
  const colorResult = useMemo(() => {
    if (!selectedValueColumn || !showColorPreview) {
      return null;
    }

    const value = rowData[selectedValueColumn];
    if (typeof value === 'number') {
      return valueToColor(value, config);
    }
    return null;
  }, [rowData, selectedValueColumn, config, showColorPreview]);

  return (
    <TableRow hover>
      {columns.map((col) => {
        const isKeyColumn = col === selectedKeyColumn;
        const isValueColumn = col === selectedValueColumn;
        const cellValue = rowData[col];

        const formatValue = (value: any): string => {
          if (value === null || value === undefined) {
            return '-';
          }
          if (typeof value === 'number') {
            return Number.isInteger(value) ? value.toString() : value.toFixed(2);
          }
          return String(value);
        };

        return (
          <TableCell
            key={col}
            sx={{
              width: columnWidths[col],
              minWidth: columnWidths[col],
              maxWidth: columnWidths[col],
              borderRight: '1px solid',
              borderColor: 'divider',
              backgroundColor: isKeyColumn
                ? theme.palette.primary.main + '10'
                : isValueColumn
                  ? theme.palette.secondary.main + '10'
                  : undefined,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Color Preview */}
              {isValueColumn && showColorPreview && colorResult && (
                <Tooltip title={`Color: ${colorResult.color}`}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: colorResult.color,
                      opacity: colorResult.opacity,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 0.5,
                    }}
                  />
                </Tooltip>
              )}

              {/* Cell Value */}
              <Typography variant="body2" noWrap>
                {formatValue(cellValue)}
              </Typography>

              {/* RGB Values (if color column) */}
              {isValueColumn && showColorPreview && colorResult?.metadata && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  ({colorResult.metadata.r}, {colorResult.metadata.g}, {colorResult.metadata.b})
                </Typography>
              )}
            </Stack>
          </TableCell>
        );
      })}
    </TableRow>
  );
});

TableRowComponent.displayName = 'TableRowComponent';

/**
  * : Styler
 * :
 * :
 * :
  */
export const StylerTablePreview: React.FC<StylerTablePreviewProps> = ({
                                                                        data,
                                                                        selectedKeyColumn,
                                                                        selectedValueColumn,
                                                                        config,
                                                                        onColumnSelect: _onColumnSelect,
                                                                        maxRows = 1000,
                                                                        // enableVirtualization = true,
                                                                      }) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [showColorPreview, setShowColorPreview] = useState(true);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return data && data.length > 0 && data[0] ? Object.keys(data[0]) : [];
  }, [data]);

  useMemo(() => {
    const initialWidths: ColumnWidths = {};
    columns.forEach(col => {
      initialWidths[col] = 150;
    });
    setColumnWidths(initialWidths);
  }, [columns]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return data.slice(0, maxRows);
    }

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted.slice(0, maxRows);
  }, [data, sortColumn, sortDirection, maxRows]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const handleColumnResize = useCallback((column: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [column]: width,
    }));
  }, []);

  // const handleColumnClick = useCallback((column: string) => {
  //   if (!onColumnSelect) return;

  //  //
  //   const isNumericColumn = data.some(row => typeof row[column] === 'number');

  //   if (column === selectedKeyColumn) {
  //  //
  //     if (isNumericColumn) {
  //       onColumnSelect(column, 'value');
  //     }
  //   } else if (column === selectedValueColumn) {
  //  //
  //     onColumnSelect('', 'value');
  //   } else {
  //  //
  //     if (!selectedKeyColumn) {
  //       onColumnSelect(column, 'key');
  //     } else if (isNumericColumn && !selectedValueColumn) {
  //       onColumnSelect(column, 'value');
  //     }
  //   }
  // }, [data, selectedKeyColumn, selectedValueColumn, onColumnSelect]);

  if (data.length === 0 || columns.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary" align="center">
          No data available for preview
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header Controls */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          Step 6: Table Preview with Style Mapping
        </Typography>

        <Stack direction="row" spacing={1}>
          <Chip
            icon={<GridViewIcon />}
            label={`${sortedData.length} / ${data.length} rows`}
            size="small"
            variant="outlined"
          />

          <IconButton
            size="small"
            onClick={() => setShowColorPreview(!showColorPreview)}
            color={showColorPreview ? 'primary' : 'default'}
          >
            {showColorPreview ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>
        </Stack>
      </Stack>

      {/* Info Messages */}
      {selectedValueColumn && (
        <Stack direction="row" spacing={1}>
          <Chip
            icon={<PaletteIcon />}
            label={`Color mapping: ${selectedValueColumn}`}
            color="secondary"
            size="small"
          />
          {showColorPreview && (
            <Chip
              label={`Algorithm: ${config.algorithm}`}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      )}

      {/* Table */}
      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <ResizableTableHeader
                  key={col}
                  column={col}
                  width={columnWidths[col] || 150}
                  onResize={handleColumnResize}
                  sortDirection={sortColumn === col ? sortDirection : null}
                  onSort={() => handleSort(col)}
                  isKeyColumn={col === selectedKeyColumn}
                  isValueColumn={col === selectedValueColumn}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row, index) => (
              <TableRowComponent
                key={index}
                rowData={row}
                columns={columns}
                columnWidths={columnWidths}
                selectedKeyColumn={selectedKeyColumn}
                selectedValueColumn={selectedValueColumn}
                config={config}
                showColorPreview={showColorPreview}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Footer Info */}
      {data.length > maxRows && (
        <Typography variant="caption" color="text.secondary" align="center">
          Showing first {maxRows} rows of {data.length} total rows
        </Typography>
      )}
    </Box>
  );
};
