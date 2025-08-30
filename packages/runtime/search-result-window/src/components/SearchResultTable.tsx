import React, { useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Box,
  Chip,
  Paper,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SearchResult } from '~/types';
import type { NodeId } from '@hierarchidb/core';

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  maxHeight: 400,
  '& .MuiTableCell-root': {
    padding: theme.spacing(0.5, 1),
    fontSize: '0.75rem',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  '& .MuiTableCell-head': {
    backgroundColor: theme.palette.grey[50],
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
}));

const StyledTableRow = styled(TableRow)<{ selected?: boolean }>(({ theme, selected }) => ({
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  ...(selected && {
    backgroundColor: theme.palette.primary.light + '20',
    '&:hover': {
      backgroundColor: theme.palette.primary.light + '30',
    },
  }),
}));

const CompactCell = styled(TableCell)(({ theme }) => ({
  maxWidth: 150,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const RowDataCell = styled(TableCell)(({ theme }) => ({
  maxWidth: 200,
  '& .row-data': {
    display: 'flex',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
}));

interface SearchResultTableProps {
  results: SearchResult[];
  selectedResults: Set<NodeId>;
  onResultSelect: (result: SearchResult, isMultiSelect: boolean) => void;
  onMapFocus: (result: SearchResult) => void;
}

export const SearchResultTable: React.FC<SearchResultTableProps> = ({
  results,
  selectedResults,
  onResultSelect,
  onMapFocus,
}) => {
  const handleRowClick = useCallback((result: SearchResult, event: React.MouseEvent) => {
    const isMultiSelect = event.shiftKey || event.metaKey || event.ctrlKey;
    onResultSelect(result, isMultiSelect);
  }, [onResultSelect]);

  const handleRowDoubleClick = useCallback((result: SearchResult) => {
    onMapFocus(result);
  }, [onMapFocus]);

  const renderRowData = useCallback((result: SearchResult) => {
    if (!result.rowData || !result.displayColumns) {
      return <Typography variant="caption">—</Typography>;
    }

    return (
      <Box className="row-data">
        {result.displayColumns.slice(0, 3).map((column) => {
          const value = result.rowData?.[column];
          if (value === undefined || value === null || value === '') {
            return null;
          }
          
          const displayValue = typeof value === 'object' 
            ? JSON.stringify(value).slice(0, 20) + '...'
            : String(value).slice(0, 15);

          return (
            <Chip
              key={column}
              label={`${column}:${displayValue}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 18 }}
            />
          );
        })}
      </Box>
    );
  }, []);

  const allSelected = useMemo(() => 
    results.length > 0 && results.every(result => selectedResults.has(result.nodeId)),
    [results, selectedResults]
  );

  const someSelected = useMemo(() =>
    results.some(result => selectedResults.has(result.nodeId)),
    [results, selectedResults]
  );

  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      results.forEach(result => onResultSelect(result, true));
    } else {
      // 全選択解除は個別に処理（実装は親コンポーネント側で）
      results.forEach(result => {
        if (selectedResults.has(result.nodeId)) {
          onResultSelect(result, false);
        }
      });
    }
  }, [results, selectedResults, onResultSelect]);

  if (results.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          検索結果がありません
        </Typography>
      </Box>
    );
  }

  return (
    <StyledTableContainer component={Paper} elevation={0}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={someSelected && !allSelected}
                checked={allSelected}
                onChange={handleSelectAll}
                size="small"
              />
            </TableCell>
            <CompactCell>StyleMap</CompactCell>
            <TableCell align="center" sx={{ width: 60 }}>行</TableCell>
            <RowDataCell>データ</RowDataCell>
            <TableCell align="center" sx={{ width: 50 }}>信頼度</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result) => {
            const isSelected = selectedResults.has(result.nodeId);
            
            return (
              <StyledTableRow
                key={`${result.nodeId}-${result.rowIndex || 0}`}
                selected={isSelected}
                onClick={(event) => handleRowClick(result, event)}
                onDoubleClick={() => handleRowDoubleClick(result)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isSelected}
                    size="small"
                    onClick={(event) => event.stopPropagation()}
                  />
                </TableCell>
                
                <CompactCell>
                  <Typography
                    variant="body2"
                    title={result.styleMapNodeName || result.nodeName}
                  >
                    {result.styleMapNodeName || result.nodeName}
                  </Typography>
                </CompactCell>
                
                <TableCell align="center">
                  <Typography variant="caption" color="primary">
                    {typeof result.rowIndex === 'number' ? result.rowIndex + 1 : '—'}
                  </Typography>
                </TableCell>
                
                <RowDataCell>
                  {renderRowData(result)}
                </RowDataCell>
                
                <TableCell align="center">
                  <Typography
                    variant="caption"
                    color={result.confidence > 0.8 ? 'success.main' : 
                           result.confidence > 0.6 ? 'warning.main' : 'error.main'}
                  >
                    {Math.round(result.confidence * 100)}%
                  </Typography>
                </TableCell>
              </StyledTableRow>
            );
          })}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
};