import type { TabularColumnInfo } from '@hierarchidb/tabular-store';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
} from '@mui/icons-material';
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
import React, { type ReactElement } from 'react';
import type { TabularFilterOperator, TabularFilterRule } from '../types/index.js';
import {
  type FilterOperatorOption,
  normalizeType,
  requiresValue,
  useTabularDataFilterRulesVirtualLogic,
} from './useTabularDataFilterRulesVirtualLogic';

export type { FilterOperatorOption };

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
  void menuContainer;

  const {
    notifyDirty,
    editingRowId,
    setEditingRowId,
    draftValuesRef,
    setDraftValues,
    normalizedRules,
    handleUpdateRule,
    handleAddRule,
    handleDeleteRule,
    viewportHeight,
    containerRef,
    containerWidth,
    handleScroll,
    handleResizeStart,
    inputHeight,
    rowCellSx,
    visibleRules,
    topSpacer,
    bottomSpacer,
    enabledCount,
    inputRefs,
  } = useTabularDataFilterRulesVirtualLogic({
    filters,
    onChange,
    onDirty,
    columns,
    operatorOptions,
    maxVisibleRows,
    rowHeight,
  });

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
              const columnType = normalizeType(
                columns.find((column) => column.name === rule.column)?.type
              );
              const availableOps = operatorOptions.filter((operator) =>
                operator.types.includes(columnType)
              );
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
                        handleUpdateRule(rule.id, (current) => ({
                          ...current,
                          enabled: nextEnabled,
                        }));
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
                          const nextType = normalizeType(
                            columns.find((column) => column.name === nextColumn)?.type
                          );
                          const ops = operatorOptions.filter((operator) =>
                            operator.types.includes(nextType)
                          );
                          const nextOp = ops.some((operator) => operator.value === rule.operator)
                            ? rule.operator
                            : (ops[0]?.value ?? 'equals');
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
                          const nextEnabled = shouldRequireValue
                            ? rule.enabled && hasValue
                            : rule.enabled;
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
                        {availableOps.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                        inputRef={(element: HTMLInputElement | null) => {
                          inputRefs.current[rule.id] = element;
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
                        onClick={(event) => {
                          event.stopPropagation();
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
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddRule}>
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
