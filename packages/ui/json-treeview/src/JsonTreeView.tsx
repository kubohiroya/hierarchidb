import React, { useMemo, useState } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, IconButton, Paper } from '@mui/material';
import { ExpandMore, ChevronRight } from '@mui/icons-material';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table';

type JsonTreeViewProps = {
  data: unknown;
  defaultExpandedDepth?: number;
  maxHeight?: number | string;
};

type JsonNode = {
  id: string;
  key: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'unknown';
  children?: JsonNode[];
};

const resolveType = (value: unknown): JsonNode['type'] => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
};

const formatValue = (value: unknown, type: JsonNode['type']): string => {
  if (type === 'object') return 'Object';
  if (type === 'array') return `Array(${Array.isArray(value) ? value.length : 0})`;
  if (type === 'string') return JSON.stringify(value ?? '');
  if (type === 'null') return 'null';
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return Number.isFinite(value as number) ? String(value) : 'NaN';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildNodes = (value: unknown, key: string, path: string, depth: number): JsonNode => {
  const type = resolveType(value);
  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const children = keys.map((childKey) =>
      buildNodes(record[childKey], childKey, `${path}.${childKey}`, depth + 1),
    );
    return { id: path, key, value, type, children };
  }
  if (type === 'array') {
    const list = Array.isArray(value) ? value : [];
    const children = list.map((child, index) =>
      buildNodes(child, `[${index}]`, `${path}[${index}]`, depth + 1),
    );
    return { id: path, key, value, type, children };
  }
  return { id: path, key, value, type };
};

const buildExpandedState = (node: JsonNode, maxDepth: number, depth = 0, expanded: Record<string, boolean> = {}) => {
  if (node.children && node.children.length > 0 && depth < maxDepth) {
    expanded[node.id] = true;
    node.children.forEach((child) => buildExpandedState(child, maxDepth, depth + 1, expanded));
  }
  return expanded;
};

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  data,
  defaultExpandedDepth = 1,
  maxHeight = 360,
}) => {
  const rootNode = useMemo(() => buildNodes(data, '(root)', 'root', 0), [data]);
  const tableData = useMemo(() => [rootNode], [rootNode]);
  const [expanded, setExpanded] = useState<ExpandedState>(() =>
    buildExpandedState(rootNode, Math.max(defaultExpandedDepth, 0)),
  );

  const columns = useMemo<ColumnDef<JsonNode>[]>(() => [
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
                {row.getIsExpanded() ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
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
          {formatValue(row.original.value, row.original.type)}
        </Typography>
      ),
    },
  ], []);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children ?? [],
    getRowId: (row) => row.id,
  });

  const rowModel = table.getRowModel();

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
