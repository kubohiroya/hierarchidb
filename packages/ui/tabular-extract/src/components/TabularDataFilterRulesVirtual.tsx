import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
} from '@mui/icons-material';
import type { TabularColumnInfo, TabularColumnType } from '@hierarchidb/tabular-store';
import type { TabularFilterOperator, TabularFilterRule } from '~/types/index';

export type FilterOperatorOption = {
  value: TabularFilterOperator;
  label: string;
  types: TabularColumnType[];
};

type FilterRulesVirtualProps = {
  filters: TabularFilterRule[];
  onChange: (rules: TabularFilterRule[]) => void;
  onDirty?: () => void;
  columns: TabularColumnInfo[];
  operatorOptions: FilterOperatorOption[];
  defaultExpanded?: boolean;
  maxVisibleRows?: number;
  rowHeight?: number;
  menuContainer?: Element | null;
  renderAsAccordion?: boolean;
  title?: string;
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

export function TabularDataFilterRulesVirtual({
  filters,
  onChange,
  onDirty,
  columns,
  operatorOptions,
  defaultExpanded = true,
  maxVisibleRows = 10,
  rowHeight = 42,
  menuContainer,
  renderAsAccordion = true,
  title = 'Filter Rules',
}: FilterRulesVirtualProps): ReactElement {
  const notifyDirty = useCallback(() => onDirty?.(), [onDirty]);
  void menuContainer;

  const firstColumnName = columns[0]?.name ?? '';
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const draftValuesRef = useRef<Record<string, string>>({});
  const normalizedRulesRef = useRef<TabularFilterRule[]>(filters);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [viewportHeight, setViewportHeight] = useState<number>(rowHeight * maxVisibleRows);
  const [scrollTop, setScrollTop] = useState(0);
  const resizingRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    draftValuesRef.current = draftValues;
  }, [draftValues]);

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
      return {
        ...rule,
        column: columnName,
        operator,
        value,
        enabled,
      };
    },
    [columns, firstColumnName, operatorOptions]
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

  const totalHeight = normalizedRules.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight));
  const overscan = Math.ceil(viewportHeight / rowHeight) + 6;
  const endIndex = Math.min(normalizedRules.length, startIndex + overscan);
  const visibleRules = normalizedRules.slice(startIndex, endIndex);
  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, totalHeight - endIndex * rowHeight);
  const enabledCount = normalizedRules.filter((rule) => rule.enabled).length;

  const inputHeight = Math.max(32, rowHeight - 10);
  const rowCellSx = { py: 0.5, height: rowHeight };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizingRef.current = { startY: e.clientY, startHeight: viewportHeight };
    const handleMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientY - resizingRef.current.startY;
      const next = Math.max(rowHeight * 5, Math.min(rowHeight * 30, resizingRef.current.startHeight + delta));
      setViewportHeight(next);
    };
    const handleUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [rowHeight, viewportHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // keep draft values in sync with rules (for added/removed rules)
  useEffect(() => {
    if (rulesEqual(normalizedRulesRef.current, normalizedRules) && Object.keys(draftValuesRef.current).length === normalizedRules.length) {
      return;
    }
    setDraftValues((prev) => {
      const next: Record<string, string> = {};
      for (const rule of normalizedRules) {
        const current = prev[rule.id];
        next[rule.id] = current ?? String(rule.value ?? '');
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameLength = prevKeys.length === nextKeys.length;
      const sameEntries =
        sameLength &&
        prevKeys.every((key) => Object.prototype.hasOwnProperty.call(next, key) && prev[key] === next[key]);
      if (sameEntries) {
        draftValuesRef.current = prev;
        return prev;
      }
      draftValuesRef.current = next;
      return next;
    });
  }, [normalizedRules]);

  const body = (
    <Box sx={{ mx: 2, pb: 2 }} ref={containerRef}>
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'auto',
          position: 'relative',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          maxHeight: viewportHeight,
          minHeight: rowHeight * 3,
          overflowX: 'hidden',
        }}
        onScroll={handleScroll}
      >
        <Table
          size="small"
          stickyHeader
          sx={{
            tableLayout: 'fixed',
            width: containerWidth ? `${Math.max(containerWidth - 8, 0)}px` : '100%',
            minWidth: containerWidth ? `${Math.max(containerWidth - 8, 0)}px` : '100%',
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell sx={rowCellSx}>Column</TableCell>
              <TableCell sx={rowCellSx}>Operator</TableCell>
              <TableCell sx={rowCellSx}>Value</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {topSpacer > 0 && (
              <TableRow sx={{ height: topSpacer }}>
                <TableCell colSpan={5} sx={{ p: 0 }} />
              </TableRow>
            )}
            {visibleRules.map((rule) => {
              const isEditing = editingRowId === rule.id;
              const columnType = normalizeType(columns.find((c) => c.name === rule.column)?.type);
              const availableOps = operatorOptions.filter((op) => op.types.includes(columnType));
              const needsValue = requiresValue(rule.operator);
              const valueDraft = draftValuesRef.current[rule.id] ?? String(rule.value ?? '');
              return (
                <TableRow
                  key={rule.id}
                  hover
                  sx={{ cursor: 'pointer', height: rowHeight }}
                  onClick={() => {
                    setEditingRowId((prev) => (prev === rule.id ? prev : rule.id));
                  }}
                >
                  <TableCell padding="checkbox" sx={rowCellSx}>
                    <Checkbox
                      size="small"
                      checked={rule.enabled && (!needsValue || valueDraft.trim().length > 0)}
                      disabled={needsValue && valueDraft.trim().length === 0}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        const nextEnabled = event.target.checked;
                        handleUpdateRule(rule.id, (current) => ({ ...current, enabled: nextEnabled }));
                      }}
                    />
                  </TableCell>
                  <TableCell sx={rowCellSx}>
                    {isEditing ? (
                      <TextField
                        select
                        size="small"
                        fullWidth
                        sx={{ '& .MuiInputBase-root': { height: inputHeight } }}
                        value={rule.column ?? ''}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                          const nextColumn = event.target.value;
                          const nextType = normalizeType(columns.find((c) => c.name === nextColumn)?.type);
                          const ops = operatorOptions.filter((op) => op.types.includes(nextType));
                          const nextOp = ops.some((op) => op.value === rule.operator)
                            ? rule.operator
                            : ops[0]?.value ?? 'equals';
                          handleUpdateRule(rule.id, (current) => ({
                            ...current,
                            column: nextColumn,
                            operator: nextOp,
                          }));
                        }}
                        SelectProps={{
                          native: true,
                          onClose: () => setEditingRowId(null),
                        }}
                        onBlur={() => setEditingRowId(null)}
                      >
                        {columns.map((column) => (
                          <option key={column.name} value={column.name}>
                            {column.name}
                          </option>
                        ))}
                      </TextField>
                    ) : (
                      <Typography variant="body2">{rule.column}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={rowCellSx}>
                    {isEditing ? (
                      <TextField
                        select
                        size="small"
                        fullWidth
                        sx={{ '& .MuiInputBase-root': { height: inputHeight } }}
                        value={rule.operator}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                          const nextOp = event.target.value as TabularFilterOperator;
                          const shouldRequireValue = requiresValue(nextOp);
                          const hasValue = valueDraft.trim().length > 0;
                          const nextEnabled = shouldRequireValue ? rule.enabled && hasValue : rule.enabled;
                          handleUpdateRule(rule.id, (current) => ({
                            ...current,
                            operator: nextOp,
                            enabled: nextEnabled,
                          }));
                        }}
                        SelectProps={{
                          native: true,
                          onClose: () => setEditingRowId(null),
                        }}
                        onBlur={() => setEditingRowId(null)}
                      >
                        {availableOps.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </TextField>
                    ) : (
                      <Typography variant="body2">{rule.operator}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={rowCellSx}>
                    {isEditing ? (
                      <TextField
                        size="small"
                        fullWidth
                        sx={{ '& .MuiInputBase-root': { height: inputHeight } }}
                        value={valueDraft}
                        disabled={!needsValue}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setDraftValues((prev) => {
                            const next = { ...prev, [rule.id]: nextValue };
                            draftValuesRef.current = next;
                            return next;
                          });
                          if (needsValue && nextValue.trim().length > 0 && !rule.enabled) {
                            handleUpdateRule(rule.id, (current) => ({ ...current, enabled: true }));
                          }
                        }}
                        onBlur={() => {
                          handleUpdateRule(rule.id, (current) => ({
                            ...current,
                            value: draftValuesRef.current[rule.id] ?? '',
                          }));
                          notifyDirty();
                          setEditingRowId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleUpdateRule(rule.id, (current) => ({
                              ...current,
                              value: draftValuesRef.current[rule.id] ?? '',
                            }));
                            notifyDirty();
                          }
                        }}
                        inputRef={(el: HTMLInputElement | null) => {
                          inputRefs.current[rule.id] = el;
                        }}
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        color={needsValue && !valueDraft ? 'text.secondary' : 'text.primary'}
                      >
                        {needsValue ? valueDraft || '—' : '(none)'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell padding="checkbox" sx={rowCellSx}>
                    <Tooltip title="Delete rule">
                      <IconButton
                        size="small"
                        aria-label="Delete rule"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRule(rule.id);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {bottomSpacer > 0 && (
              <TableRow sx={{ height: bottomSpacer }}>
                <TableCell colSpan={5} sx={{ p: 0 }} />
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Box
          role="presentation"
          sx={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 14,
            height: 14,
            borderRight: '2px solid',
            borderBottom: '2px solid',
            borderColor: 'divider',
            cursor: 'nwse-resize',
          }}
          onMouseDown={handleResizeStart}
        />
      </Box>
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddRule}
        >
          Add Filter Rule
        </Button>
        <Typography variant="body2" color="text.secondary">
          {`${enabledCount} Enabled / ${normalizedRules.length} Rules`}
        </Typography>
      </Box>
    </Box>
  );

  if (!renderAsAccordion) {
    return (
      <Box sx={{ pb: 2 }}>
        {title ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FilterAltIcon fontSize="small" />
            <Typography variant="subtitle1">{title}</Typography>
          </Box>
        ) : null}
        {body}
      </Box>
    );
  }

  return (
    <Accordion defaultExpanded={defaultExpanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterAltIcon fontSize="small" />
          <Typography variant="subtitle1">{title}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pb: 2 }}>{body}</AccordionDetails>
    </Accordion>
  );
}
