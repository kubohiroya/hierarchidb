import type { FdmDialogData, FdmSpaceCatalog } from '@hierarchidb/fdm-api';
import type {
  IdeGsmConnectionHealthResult,
  IdeGsmConnectionInput,
} from '@hierarchidb/ui-ide-gsm-connection';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { FdmPluginRuntime } from '../fdmStepProviderTypes.js';

export interface FdmSpaceSelectionStepProps {
  readonly data: FdmDialogData;
  readonly persistedConnection: IdeGsmConnectionInput | null;
  readonly health: IdeGsmConnectionHealthResult;
  readonly runtime: FdmPluginRuntime;
  readonly disabled?: boolean;
  readonly onChange: (next: FdmDialogData) => void;
}

type LoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly catalog: FdmSpaceCatalog }
  | { readonly status: 'failed'; readonly code: string };

export function FdmSpaceSelectionStep({
  data,
  persistedConnection,
  health,
  runtime,
  disabled = false,
  onChange,
}: FdmSpaceSelectionStepProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [newSpaceName, setNewSpaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const fdmRuntime = runtime.fdmRuntime;
  const connectionName = persistedConnection?.connectionName ?? '';

  useEffect(() => {
    if (!fdmRuntime || !persistedConnection || health.status !== 'healthy') {
      setLoadState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setLoadState({ status: 'loading' });
    fdmRuntime
      .listSpaces(persistedConnection.connectionName, controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setLoadState({ status: 'loaded', catalog });
        if (!data.spaceId && catalog.defaultSpaceId.length > 0) {
          onChange({ ...data, spaceId: catalog.defaultSpaceId });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadState({ status: 'failed', code: 'FDM_SPACES_UNAVAILABLE' });
        }
      });
    return () => {
      controller.abort();
    };
  }, [data, fdmRuntime, health.status, onChange, persistedConnection]);

  const canCreate =
    !!fdmRuntime?.createSpace &&
    !!persistedConnection &&
    health.status === 'healthy' &&
    newSpaceName.trim().length > 0 &&
    !creating;

  const createSpace = async () => {
    if (!fdmRuntime?.createSpace || !persistedConnection) return;
    setCreating(true);
    try {
      const created = await fdmRuntime.createSpace({
        connectionName,
        requestedName: newSpaceName.trim(),
        signal: new AbortController().signal,
      });
      onChange({ ...data, spaceId: created.spaceId });
      setNewSpaceName('');
    } finally {
      setCreating(false);
    }
  };

  const spaces = loadState.status === 'loaded' ? loadState.catalog.spaces : [];

  return (
    <Stack spacing={2}>
      <Box aria-live="polite">
        {loadState.status === 'idle' && (
          <Typography variant="body2" color="text.secondary">
            Select a healthy connection to load FDM spaces.
          </Typography>
        )}
        {loadState.status === 'loading' && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="body2">Loading FDM spaces</Typography>
          </Stack>
        )}
        {loadState.status === 'failed' && <Alert severity="error">{loadState.code}</Alert>}
      </Box>
      <FormControl fullWidth disabled={disabled || spaces.length === 0}>
        <InputLabel id="fdm-space-label">FDM space</InputLabel>
        <Select
          labelId="fdm-space-label"
          label="FDM space"
          value={data.spaceId ?? ''}
          onChange={(event) => onChange({ ...data, spaceId: event.target.value })}
        >
          {spaces.map((space) => (
            <MenuItem key={space.spaceId} value={space.spaceId}>
              {space.spaceId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {fdmRuntime?.createSpace && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            label="New FDM space"
            value={newSpaceName}
            disabled={disabled || health.status !== 'healthy'}
            onChange={(event) => setNewSpaceName(event.target.value)}
          />
          <Button
            variant="outlined"
            disabled={disabled || !canCreate}
            onClick={() => {
              void createSpace();
            }}
          >
            Create
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
