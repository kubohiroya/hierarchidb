import {
  type ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

export type JsonNode = {
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

export const formatJsonNodeValue = (value: unknown, type: JsonNode['type']): string => {
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

const buildNodes = (value: unknown, key: string, path: string): JsonNode => {
  const type = resolveType(value);
  if (type === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const children = keys.map((childKey) =>
      buildNodes(record[childKey], childKey, `${path}.${childKey}`)
    );
    return { id: path, key, value, type, children };
  }
  if (type === 'array') {
    const list = Array.isArray(value) ? value : [];
    const children = list.map((child, index) =>
      buildNodes(child, `[${index}]`, `${path}[${index}]`)
    );
    return { id: path, key, value, type, children };
  }
  return { id: path, key, value, type };
};

const buildExpandedState = (
  node: JsonNode,
  maxDepth: number,
  depth = 0,
  expanded: Record<string, boolean> = {}
) => {
  if (node.children && node.children.length > 0 && depth < maxDepth) {
    expanded[node.id] = true;
    node.children.forEach((child) => buildExpandedState(child, maxDepth, depth + 1, expanded));
  }
  return expanded;
};

type UseJsonTreeViewParams = {
  data: unknown;
  defaultExpandedDepth: number;
  columns: ColumnDef<JsonNode>[];
};

export const useJsonTreeView = ({ data, defaultExpandedDepth, columns }: UseJsonTreeViewParams) => {
  const rootNode = useMemo(() => buildNodes(data, '(root)', 'root'), [data]);
  const tableData = useMemo(() => [rootNode], [rootNode]);
  const [expanded, setExpanded] = useState<ExpandedState>(() =>
    buildExpandedState(rootNode, Math.max(defaultExpandedDepth, 0))
  );

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

  return {
    table,
    rowModel: table.getRowModel(),
  };
};
