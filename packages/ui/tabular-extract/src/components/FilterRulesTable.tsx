import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { type ColumnDef, type Row, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { TabularColumnInfo, TabularColumnType } from '@hierarchidb/tabular-store';
import type { TabularFilterOperator, TabularFilterRule } from '../types/index.js';

export type FilterOperatorOption = {
  value: TabularFilterOperator;
  label: string;
  types: TabularColumnType[];
};

type FilterRulesTableProps = {
  filters: TabularFilterRule[];
  onChange: (rules: TabularFilterRule[]) => void;
  columns: TabularColumnInfo[];
  operatorOptions: FilterOperatorOption[];
  defaultExpanded?: boolean;
  onPreview?: () => void;
  previewDisabled?: boolean;
  previewLoading?: boolean;
};

const requiresValue = (operator: TabularFilterOperator): boolean => {
  return operator !== 'is_null' && operator !== 'is_not_null';
};

const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';

const getRuleId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rule-${Math.random().toString(36).slice(2, 10)}`;
};

const reorder = (list: TabularFilterRule[], fromId: string, toId: string): TabularFilterRule[] => {
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;

  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return list;
  next.splice(toIndex, 0, moved);
  return next;
};

const rulesEqual = (a: TabularFilterRule[], b: TabularFilterRule[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.column !== right.column ||
      left.operator !== right.operator ||
      left.value !== right.value ||
      left.enabled !== right.enabled
    ) {
      return false;
    }
  }
  return true;
};

export function FilterRulesTable({
  filters,
  onChange,
  columns,
  operatorOptions,
  defaultExpanded = true,
  onPreview,
  previewDisabled,
  previewLoading,
}: FilterRulesTableProps): ReactElement {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const draftValuesRef = useRef<Record<string, string>>({});
  const normalizedRulesRef = useRef<TabularFilterRule[]>(filters);

  useEffect(() => {
    draftValuesRef.current = draftValues;
  }, [draftValues]);

  const firstColumnName = columns[0]?.name ?? '';

  // Keep local draft values in sync with incoming filters (add new, drop removed; preserve in-flight edits).
  useEffect(() => {
    setDraftValues((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const rule of filters) {
        const current = prev[rule.id];
        const fallback = String(rule.value ?? '');
        next[rule.id] = current ?? fallback;
        if (current === undefined) changed = true;
      }
      if (Object.keys(prev).length !== Object.keys(next).length || changed) {
        draftValuesRef.current = next;
        return next;
      }
      draftValuesRef.current = prev;
      return prev;
    });
  }, [filters]);

  const ensureRule = useCallback(
    (rule: TabularFilterRule): TabularFilterRule => {
      const columnName = rule.column && columns.some((c) => c.name === rule.column)
        ? rule.column
        : firstColumnName;
      const columnType = normalizeType(columns.find((c) => c.name === columnName)?.type);
      const availableOps = operatorOptions.filter((op) => op.types.includes(columnType));
      const operator = availableOps.some((op) => op.value === rule.operator)
        ? rule.operator
        : availableOps[0]?.value ?? 'equals';
      const shouldRequireValue = operator ? requiresValue(operator) : false;
      const value = rule.value ?? '';
      const enabled = shouldRequireValue ? (rule.enabled && String(value).trim().length > 0) : rule.enabled;

      if (
        rule.column === columnName &&
        rule.operator === operator &&
        rule.value === value &&
        rule.enabled === enabled
      ) {
        return rule;
      }

      return {
        ...rule,
        column: columnName,
        operator: operator ?? 'equals',
        value,
        enabled,
      };
    },
    [firstColumnName, operatorOptions, columns]
  );

  const normalizedRules = useMemo<TabularFilterRule[]>(() => {
    const next = filters.map(ensureRule);
    if (rulesEqual(next, normalizedRulesRef.current)) {
      return normalizedRulesRef.current;
    }
    normalizedRulesRef.current = next;
    return next;
  }, [filters, ensureRule]);

  useEffect(() => {
    normalizedRulesRef.current = normalizedRules;
  }, [normalizedRules]);

  const paginationState = useMemo(
    () => ({
      pageIndex: 0,
      pageSize: Math.max(1, normalizedRules.length || 1),
    }),
    [normalizedRules.length]
  );

  const handleUpdateRule = useCallback(
    (id: string, updater: (current: TabularFilterRule) => TabularFilterRule) => {
      const currentRules = normalizedRulesRef.current;
      const next = currentRules.map((rule) => (rule.id === id ? ensureRule(updater(rule)) : rule));
      if (!rulesEqual(next, currentRules)) {
        onChange(next);
      }
    },
    [ensureRule, onChange]
  );

  const commitDraftValue = useCallback(
    (ruleId: string) => {
      const currentRules = normalizedRulesRef.current;
      const target = currentRules.find((rule) => rule.id === ruleId);
      if (!target) return;
      const pending = draftValuesRef.current[ruleId];
      const nextValue = pending ?? '';
      const needsValue = requiresValue(target.operator);
      const nextEnabled = needsValue ? target.enabled && nextValue.trim().length > 0 : target.enabled;
      handleUpdateRule(ruleId, (current) => ({
        ...current,
        value: nextValue,
        enabled: nextEnabled,
      }));
    },
    [handleUpdateRule]
  );

  const handleAddRule = useCallback(() => {
    const columnName = firstColumnName;
    const columnType = normalizeType(columns.find((c) => c.name === columnName)?.type);
    const availableOps = operatorOptions.filter((op) => op.types.includes(columnType));
    const operator = availableOps[0]?.value ?? 'equals';
    const newRule: TabularFilterRule = {
      id: getRuleId(),
      column: columnName,
      operator,
      value: '',
      enabled: false,
    };
    const next = [...normalizedRules, newRule];
    onChange(next);
  }, [firstColumnName, normalizedRules, onChange, operatorOptions, columns]);

  const handleDeleteRule = useCallback(
    (id: string) => {
      const next = normalizedRules.filter((rule) => rule.id !== id);
      if (!rulesEqual(next, normalizedRules)) {
        onChange(next);
      }
    },
    [normalizedRules, onChange]
  );

  const columnsDef = useMemo<ColumnDef<TabularFilterRule>[]>(
    () => [
      {
        id: 'reorder',
        header: '',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => (
          <IconButton
            size="small"
            aria-label="Drag to reorder"
            onMouseDown={() => setDraggingId(row.original.id)}
            onMouseUp={() => setDraggingId(null)}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', row.original.id);
              const tr = event.currentTarget.closest('tr') as HTMLTableRowElement | null;
              if (tr) {
                const rect = tr.getBoundingClientRect();
                const anchorX = event.clientX - rect.left;
                const anchorY = event.clientY - rect.top;
                event.dataTransfer.setDragImage(tr, anchorX, anchorY);
              }
              setDraggingId(row.original.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            onDragLeave={() => setDraggingId(null)}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        ),
        size: 40,
      },
      {
        id: 'enabled',
        header: '',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => {
          const rule = row.original;
          const operator = rule.operator;
          const needsValue = requiresValue(operator);
          const hasValue = String(rule.value ?? '').trim().length > 0;
          const canEnable = !needsValue || hasValue;
          return (
            <Checkbox
              size="small"
              checked={rule.enabled && canEnable}
              disabled={!canEnable}
              inputProps={{
                'aria-label': 'Enable filter rule',
                id: `filter-enabled-${rule.id}`,
                name: `filter-enabled-${rule.id}`,
              }}
              onChange={(event) => {
                const nextEnabled = event.target.checked;
                handleUpdateRule(rule.id, (current) => ({ ...current, enabled: nextEnabled }));
              }}
            />
          );
        },
        size: 48,
      },
      {
        id: 'column',
        header: 'Column',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => {
          const rule = row.original;
          return (
            <TextField
              select
              fullWidth
              size="small"
              value={rule.column ?? ''}
              label="Column"
              onChange={(event) => {
                const nextColumn = event.target.value;
                const columnType = normalizeType(columns.find((c) => c.name === nextColumn)?.type);
                const availableOps = operatorOptions.filter((op) => op.types.includes(columnType));
                const nextOperator = availableOps.some((op) => op.value === rule.operator)
                  ? rule.operator
                  : availableOps[0]?.value ?? 'equals';
                handleUpdateRule(rule.id, (current) => ({
                  ...current,
                  column: nextColumn,
                  operator: nextOperator,
                }));
              }}
              SelectProps={{
                native: true,
                MenuProps: {
                  MenuListProps: {
                    dense: true,
                  },
                },
              }}
              inputProps={{
                'aria-label': 'Column',
                id: `filter-column-${rule.id}`,
                name: `filter-column-${rule.id}`,
              }}
            >
              {columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </TextField>
          );
        },
        size: 200,
      },
      {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => {
          const rule = row.original;
          const columnType = normalizeType(columns.find((c) => c.name === rule.column)?.type);
          const availableOps = operatorOptions.filter((op) => op.types.includes(columnType));
          return (
            <TextField
              select
              fullWidth
              size="small"
              value={rule.operator}
              label="Operator"
              onChange={(event) => {
                const nextOp = event.target.value as TabularFilterOperator;
                const shouldRequireValue = nextOp ? requiresValue(nextOp) : false;
                const hasValue = String(rule.value ?? '').trim().length > 0;
                const nextEnabled = shouldRequireValue ? rule.enabled && hasValue : rule.enabled;
                handleUpdateRule(rule.id, (current) => ({
                  ...current,
                  operator: nextOp,
                  enabled: nextEnabled,
                }));
              }}
              SelectProps={{
                native: true,
                MenuProps: {
                  MenuListProps: {
                    dense: true,
                  },
                },
              }}
              inputProps={{
                'aria-label': 'Operator',
                id: `filter-operator-${rule.id}`,
                name: `filter-operator-${rule.id}`,
              }}
            >
              {availableOps.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </TextField>
          );
        },
        size: 200,
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => {
          const rule = row.original;
          const operator = rule.operator;
          const needsValue = requiresValue(operator);
          const value = draftValuesRef.current[rule.id] ?? String(rule.value ?? '');
          return (
            <TextField
              fullWidth
              size="small"
              label="Value"
              value={value}
              disabled={!needsValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraftValues((prev) => {
                  const next = { ...prev, [rule.id]: nextValue };
                  draftValuesRef.current = next;
                  return next;
                });
              }}
              onBlur={() => commitDraftValue(rule.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitDraftValue(rule.id);
                }
              }}
              inputProps={{
                'aria-label': 'Value',
                id: `filter-value-${rule.id}`,
                name: `filter-value-${rule.id}`,
              }}
            />
          );
        },
        size: 240,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }: { row: Row<TabularFilterRule> }) => (
          <IconButton
            size="small"
            aria-label="Delete rule"
            onClick={() => handleDeleteRule(row.original.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
        size: 48,
      },
    ],
    [handleDeleteRule, handleUpdateRule, operatorOptions, columns]
  );

  const table = useReactTable({
    data: normalizedRules,
    columns: columnsDef,
    state: { pagination: paginationState },
    onPaginationChange: () => {
      /* no-op to keep table controlled */
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const handleDrop = (targetId: string, event: React.DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData('text/plain');
    if (!sourceId) return;
    onChange(reorder(normalizedRules, sourceId, targetId));
    setDraggingId(null);
  };

  const totalEnabled = normalizedRules.filter((rule) => rule.enabled).length;

  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="subtitle1">Filter Rules (Enabled {totalEnabled}/{normalizedRules.length})</Typography>
          <Typography variant="caption" color="text.secondary">
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(row.original.id, event)}
                  sx={{
                    opacity: draggingId === row.original.id ? 0.25 : 1,
                    backgroundColor: draggingId === row.original.id ? 'rgba(0,0,0,0.06)' : undefined,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} sx={{ verticalAlign: 'middle', py: '5px', px: '4px' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddRule}
            disabled={columns.length === 0}
          >
            Add Filter Rule
          </Button>

          {onPreview && (
            <Button
              variant="outlined"
              startIcon={previewLoading ? <CircularProgress size={16} /> : <ArrowDownwardIcon />}
              onClick={onPreview}
              disabled={previewDisabled}
            >
              {previewLoading ? 'Loading Preview...' : 'Preview Filtered Data'}
            </Button>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
