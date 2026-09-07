import type { FdmDialogData } from '@hierarchidb/fdm-api';
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/react/utils';
import { createStore } from 'jotai/vanilla';
import { queryClientAtom } from 'jotai-tanstack-query';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { FdmPluginRuntime } from '../fdmStepProviderTypes.js';
import {
  fdmSpaceCatalogQueryAtom,
  fdmSpaceCreateMutationAtom,
  fdmSpaceSelectionConnectionAtom,
  fdmSpaceSelectionHealthAtom,
  fdmSpaceSelectionRuntimeAtom,
} from './fdmSpaceSelectionAtoms.js';

export interface FdmSpaceSelectionStepProps {
  readonly data: FdmDialogData;
  readonly persistedConnection: IdeGsmConnectionInput | null;
  readonly health: IdeGsmConnectionHealthResult;
  readonly runtime: FdmPluginRuntime;
  readonly disabled?: boolean;
  readonly onChange: (next: FdmDialogData) => void;
}

export function FdmSpaceSelectionStep(props: FdmSpaceSelectionStepProps) {
  const store = useMemo(() => createStore(), []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProviderBridge store={store} queryClient={queryClient}>
        <FdmSpaceSelectionStepBody {...props} />
      </JotaiProviderBridge>
    </QueryClientProvider>
  );
}

function JotaiProviderBridge({
  store,
  queryClient,
  children,
}: {
  readonly store: ReturnType<typeof createStore>;
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}) {
  return (
    <JotaiProvider store={store}>
      <HydrateQueryClient queryClient={queryClient}>{children}</HydrateQueryClient>
    </JotaiProvider>
  );
}

function HydrateQueryClient({
  queryClient,
  children,
}: {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}) {
  useHydrateAtoms([[queryClientAtom, queryClient]]);
  return children;
}

function FdmSpaceSelectionStepBody({
  data,
  persistedConnection,
  health,
  runtime,
  disabled = false,
  onChange,
}: FdmSpaceSelectionStepProps) {
  const [newSpaceName, setNewSpaceName] = useState('');
  const setRuntime = useSetAtom(fdmSpaceSelectionRuntimeAtom);
  const setPersistedConnection = useSetAtom(fdmSpaceSelectionConnectionAtom);
  const setHealth = useSetAtom(fdmSpaceSelectionHealthAtom);
  const queryResult = useAtomValue(fdmSpaceCatalogQueryAtom);
  const [createResult] = useAtom(fdmSpaceCreateMutationAtom);
  const fdmRuntime = runtime.fdmRuntime;

  useEffect(() => {
    setRuntime(runtime);
  }, [runtime, setRuntime]);

  useEffect(() => {
    setPersistedConnection(persistedConnection);
  }, [persistedConnection, setPersistedConnection]);

  useEffect(() => {
    setHealth(health);
  }, [health, setHealth]);

  useEffect(() => {
    const catalog = queryResult.data;
    if (!catalog || data.spaceId || catalog.defaultSpaceId.length === 0) return;
    onChange({ ...data, spaceId: catalog.defaultSpaceId });
  }, [data, onChange, queryResult.data]);

  const canCreate =
    !!fdmRuntime?.createSpace &&
    !!persistedConnection &&
    health.status === 'healthy' &&
    newSpaceName.trim().length > 0 &&
    !createResult.isPending;

  const createSpace = async () => {
    if (!fdmRuntime?.createSpace || !persistedConnection) return;
    try {
      const spaceId = await createResult.mutateAsync(newSpaceName.trim());
      onChange({ ...data, spaceId });
      setNewSpaceName('');
    } catch {
      // The mutation atom exposes the error through createResult.error.
    }
  };

  const spaces = queryResult.data?.spaces ?? [];
  const loadError = queryResult.error ? 'FDM_SPACES_UNAVAILABLE' : undefined;
  const createError = createResult.error ? 'FDM_SPACE_CREATE_FAILED' : undefined;

  return (
    <Stack spacing={2}>
      <Box aria-live="polite">
        {(!fdmRuntime || !persistedConnection || health.status !== 'healthy') && (
          <Typography variant="body2" color="text.secondary">
            Select a healthy connection to load FDM spaces.
          </Typography>
        )}
        {queryResult.isFetching ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="body2">Loading FDM spaces</Typography>
          </Stack>
        ) : null}
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}
        {createError ? <Alert severity="error">{createError}</Alert> : null}
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
            {createResult.isPending ? 'Creating' : 'Create'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
