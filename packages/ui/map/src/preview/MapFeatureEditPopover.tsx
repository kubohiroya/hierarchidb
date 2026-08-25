import type {
  GridCellEditCommitResult,
  GridCellEditParams,
  GridCellEditStateChange,
  GridColumn,
} from '@hierarchidb/ui-grid';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  commitFeatureTableCellEdit,
  type FeatureTableEditConfig,
  findFeatureTableEditableColumn,
} from './featureTableEditContract.js';

type RowRecord = { id: string | number } & Record<PropertyKey, unknown>;

export type MapFeatureEditPopoverProps<Row extends RowRecord> = {
  open: boolean;
  row: Row | null | undefined;
  columns: GridColumn<Row>[];
  featureTableEdit?: FeatureTableEditConfig<Row>;
  title?: string;
  initialColumnId?: string;
  onClose?: () => void;
  onCellEditStateChange?: (state: GridCellEditStateChange<Row>) => void;
};

const getCellValue = <Row extends RowRecord>(row: Row, columnId: string): unknown =>
  Object.hasOwn(row, columnId) ? row[columnId] : undefined;

const isFailedEditResult = (
  result: void | GridCellEditCommitResult
): result is Extract<GridCellEditCommitResult, { ok: false }> =>
  typeof result === 'object' && result !== null && result.ok === false;

export const commitMapFeaturePopoverEdit = <Row extends RowRecord>(
  params: GridCellEditParams<Row>,
  featureTableEdit: FeatureTableEditConfig<Row> | undefined
): Promise<void | GridCellEditCommitResult> =>
  commitFeatureTableCellEdit(params, featureTableEdit, 'map-feature-popover');

export const MapFeatureEditPopover = <Row extends RowRecord>({
  open,
  row,
  columns,
  featureTableEdit,
  title = 'Feature',
  initialColumnId,
  onClose,
  onCellEditStateChange,
}: MapFeatureEditPopoverProps<Row>) => {
  const editableColumns = useMemo(
    () =>
      columns.filter((column) =>
        findFeatureTableEditableColumn(featureTableEdit?.editableColumns ?? [], String(column.id))
      ),
    [columns, featureTableEdit?.editableColumns]
  );
  const initialEditableColumnId = initialColumnId ?? String(editableColumns[0]?.id ?? '');
  const [selectedColumnId, setSelectedColumnId] = useState(initialEditableColumnId);
  const [draftValue, setDraftValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedColumn = columns.find((column) => String(column.id) === selectedColumnId);
  const previousValue = row && selectedColumnId ? getCellValue(row, selectedColumnId) : undefined;

  useEffect(() => {
    if (!open || !row) return;
    const nextColumnId = initialColumnId ?? String(editableColumns[0]?.id ?? '');
    setSelectedColumnId(nextColumnId);
    setDraftValue(String(getCellValue(row, nextColumnId) ?? ''));
    setEditing(false);
    setPending(false);
    setError(null);
  }, [editableColumns, initialColumnId, open, row]);

  const emitState = useCallback(
    (phase: GridCellEditStateChange<Row>['phase'], value: string, stateError?: string) => {
      if (!row || !selectedColumnId) return;
      onCellEditStateChange?.({
        row,
        rowId: row.id,
        columnId: selectedColumnId,
        phase,
        previousValue,
        value,
        error: stateError,
      });
    },
    [onCellEditStateChange, previousValue, row, selectedColumnId]
  );

  const handleStartEdit = useCallback(() => {
    const nextValue = String(previousValue ?? '');
    setDraftValue(nextValue);
    setEditing(true);
    setError(null);
    emitState('start', nextValue);
  }, [emitState, previousValue]);

  const handleCancel = useCallback(() => {
    const rollbackValue = String(previousValue ?? '');
    setDraftValue(rollbackValue);
    setEditing(false);
    setError(null);
    emitState('cancel', rollbackValue);
  }, [emitState, previousValue]);

  const handleSave = useCallback(async () => {
    if (!row || !selectedColumnId) return;
    setPending(true);
    setError(null);
    emitState('pending', draftValue);
    const result = await commitMapFeaturePopoverEdit(
      {
        row,
        rowId: row.id,
        columnId: selectedColumnId,
        previousValue,
        value: draftValue,
      },
      featureTableEdit
    );
    setPending(false);
    if (isFailedEditResult(result)) {
      const rollbackValue = String(previousValue ?? '');
      setError(result.error);
      setDraftValue(rollbackValue);
      emitState('failure', draftValue, result.error);
      emitState('rollback', rollbackValue, result.error);
      return;
    }
    emitState('success', draftValue);
    setEditing(false);
  }, [draftValue, emitState, featureTableEdit, previousValue, row, selectedColumnId]);

  if (!open || !row) return null;

  return (
    <Paper
      role="dialog"
      aria-label={title}
      elevation={4}
      sx={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 5,
        width: 320,
        maxWidth: 'calc(100% - 32px)',
        p: 2,
        display: 'grid',
        gap: 1.5,
      }}
    >
      <Box sx={{ fontWeight: 600 }}>{title}</Box>
      {editableColumns.length > 0 ? (
        <>
          <FormControl size="small" fullWidth disabled={pending || editing}>
            <InputLabel id="map-feature-edit-field-label">Field</InputLabel>
            <Select
              labelId="map-feature-edit-field-label"
              label="Field"
              value={selectedColumnId}
              onChange={(event) => {
                const nextColumnId = event.target.value;
                setSelectedColumnId(nextColumnId);
                setDraftValue(String(getCellValue(row, nextColumnId) ?? ''));
                setError(null);
              }}
            >
              {editableColumns.map((column) => (
                <MenuItem key={String(column.id)} value={String(column.id)}>
                  {column.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={selectedColumn?.label ?? selectedColumnId}
            value={editing ? draftValue : String(previousValue ?? '')}
            onChange={(event) => {
              setDraftValue(event.target.value);
              emitState('dirty', event.target.value);
            }}
            disabled={!editing || pending}
            error={Boolean(error)}
            helperText={error ?? undefined}
            fullWidth
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {editing ? (
              <>
                <Button size="small" onClick={handleCancel} disabled={pending}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={handleSave} disabled={pending}>
                  Save
                </Button>
              </>
            ) : (
              <Button size="small" variant="contained" onClick={handleStartEdit}>
                Edit
              </Button>
            )}
            <Button size="small" onClick={onClose} disabled={pending}>
              Close
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.75 }}>
            {columns.map((column) => (
              <Box
                key={String(column.id)}
                sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}
              >
                <Box component="dt" sx={{ color: 'text.secondary' }}>
                  {column.label}
                </Box>
                <Box component="dd" sx={{ m: 0 }}>
                  {String(getCellValue(row, String(column.id)) ?? '')}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={onClose}>
              Close
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};
