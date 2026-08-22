import { ChevronRight, ExpandMore } from '@mui/icons-material';
import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { type ColumnDef, flexRender } from '@tanstack/react-table';
import React, { useMemo } from 'react';
import { formatJsonNodeValue, type JsonNode, useJsonTreeView } from './useJsonTreeView';

type JsonTreeViewProps = {
  data: unknown;
  defaultExpandedDepth?: number;
  maxHeight?: number | string;
};

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  data,
  defaultExpandedDepth = 1,
  maxHeight = 360,
}) => {
  const columns = useMemo<ColumnDef<JsonNode>[]>(
    () => [
      {
        id: 'key',
        header: 'Key',
        cell: ({ row }) => {
          const canExpand = row.getCanExpand();
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                pl: row.depth * 16,
                minWidth: 0,
              }}
            >
              {canExpand ? (
                <IconButton
                  size="small"
                  onClick={row.getToggleExpandedHandler()}
                  aria-label={row.getIsExpanded() ? 'Collapse' : 'Expand'}
                >
                  {row.getIsExpanded() ? (
                    <ExpandMore fontSize="small" />
                  ) : (
                    <ChevronRight fontSize="small" />
                  )}
                </IconButton>
              ) : (
                <Box sx={{ width: 32 }} />
              )}
              <Typography variant="body2" noWrap>
                {row.original.key}
              </Typography>
            </Box>
          );
        },
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatJsonNodeValue(row.original.value, row.original.type)}
          </Typography>
        ),
      },
    ],
    []
  );

  const { table, rowModel } = useJsonTreeView({
    data,
    defaultExpandedDepth,
    columns,
  });

  return (
    <TableContainer component={Paper} sx={{ maxHeight, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell key={header.id} sx={{ fontWeight: 600 }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {rowModel.rows.map((row) => (
            <TableRow key={row.id} hover>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} sx={{ py: 0.5 }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
