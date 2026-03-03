import React, { useId } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SearchResult } from '~/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import { useSearchResultTable } from './useSearchResultTable.js';

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

const CompactCell = styled(TableCell)(({ theme: _theme }) => ({
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
                                                                      selectedResults: propsSelectedResults, //  props
                                                                      onResultSelect,
                                                                      onMapFocus,
                                                                    }) => {
  const controlId = useId();
  const {
    selectedResults,
    allSelected,
    someSelected,
    handleRowClick,
    handleRowDoubleClick,
    handleSelectAll,
    getRowChips,
    getConfidenceColor,
  } = useSearchResultTable({
    results,
    selectedResults: propsSelectedResults,
    onResultSelect,
    onMapFocus,
  });

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
    <StyledTableContainer>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={someSelected && !allSelected}
                checked={allSelected}
                onChange={handleSelectAll}
                size="small"
                inputProps={{
                  'aria-label': 'Select all search results',
                  id: `${controlId}-select-all`,
                  name: 'select-all-results',
                }}
              />
            </TableCell>
            <CompactCell>Styler</CompactCell>
            <TableCell align="center" sx={{ width: 60 }}>
              行
            </TableCell>
            <RowDataCell>データ</RowDataCell>
            <TableCell align="center" sx={{ width: 50 }}>
              信頼度
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result) => {
            const isSelected = selectedResults.has(result.nodeId);
            const rowChips = getRowChips(result);

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
                    inputProps={{
                      'aria-label': `Select ${result.nodeName}`,
                      id: `${controlId}-${result.nodeId}`,
                      name: `select-${result.nodeId}`,
                    }}
                  />
                </TableCell>

                <CompactCell>
                  <Typography variant="body2" title={result.stylerNodeName || result.nodeName}>
                    {result.stylerNodeName || result.nodeName}
                  </Typography>
                </CompactCell>

                <TableCell align="center">
                  <Typography variant="caption" color="primary">
                    {typeof result.rowIndex === 'number' ? result.rowIndex + 1 : '—'}
                  </Typography>
                </TableCell>

                <RowDataCell>
                  {rowChips.length === 0 ? (
                    <Typography variant="caption">—</Typography>
                  ) : (
                    <Box className="row-data">
                      {rowChips.map((chip) => (
                        <Chip
                          key={chip.key}
                          label={chip.label}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      ))}
                    </Box>
                  )}
                </RowDataCell>

                <TableCell align="center">
                  <Typography
                    variant="caption"
                    color={getConfidenceColor(result.confidence)}
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
