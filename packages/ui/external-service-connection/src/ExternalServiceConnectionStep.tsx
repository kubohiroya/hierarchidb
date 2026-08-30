import { useExternalServiceHealth } from '@hierarchidb/ui-external-service-health';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type {
  ExternalServiceConnectionDraft,
  ExternalServiceConnectionInput,
  ExternalServiceConnectionStepProps,
  ExternalServiceNamedConnectionSummary,
} from './externalServiceConnectionTypes.js';
import { validateExternalServiceConnectionDraft } from './validateExternalServiceConnectionDraft.js';

const DEFAULT_LABELS = {
  connectionName: 'Connection name',
  manualTarget: 'Manual target',
  host: 'Server hostname or IP address',
  port: 'Port',
  corsProxy: 'Connect through cors-proxy',
  health: 'Health',
} as const;

export const createEmptyExternalServiceConnectionDraft = (): ExternalServiceConnectionDraft => ({
  connectionName: '',
  manualTargetEnabled: false,
  manualHost: '',
  manualPort: '',
  useCorsProxy: false,
});

export function ExternalServiceConnectionStep({
  value,
  provider,
  disabled = false,
  labels,
  healthDebounceMs,
  children,
  onChange,
  onPersistedValueChange,
  onHealthChange,
}: ExternalServiceConnectionStepProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const [connections, setConnections] = useState<
    ReadonlyArray<ExternalServiceNamedConnectionSummary>
  >([]);
  const [persistedValue, setPersistedValue] = useState<ExternalServiceConnectionInput | null>(null);

  useEffect(() => {
    let cancelled = false;
    provider
      .listConnections()
      .then((next) => {
        if (!cancelled) setConnections(next);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    validateExternalServiceConnectionDraft(value, provider)
      .then((result) => {
        if (cancelled) return;
        const next = result.ok ? result.value : null;
        setPersistedValue(next);
        onPersistedValueChange?.(next);
      })
      .catch(() => {
        if (cancelled) return;
        setPersistedValue(null);
        onPersistedValueChange?.(null);
      });
    return () => {
      cancelled = true;
    };
  }, [onPersistedValueChange, provider, value]);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.name === value.connectionName),
    [connections, value.connectionName]
  );
  const health = useExternalServiceHealth({
    checker: provider,
    value: persistedValue,
    debounceMs: healthDebounceMs,
    unavailableCode: 'CONNECTION_UNAVAILABLE',
  });

  useEffect(() => {
    onHealthChange?.(health);
  }, [health, onHealthChange]);

  const update = (patch: Partial<ExternalServiceConnectionDraft>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <Stack spacing={2}>
      <FormControl fullWidth disabled={disabled || value.manualTargetEnabled}>
        <InputLabel id="external-service-connection-name-label">
          {mergedLabels.connectionName}
        </InputLabel>
        <Select
          labelId="external-service-connection-name-label"
          label={mergedLabels.connectionName}
          value={value.connectionName}
          onChange={(event) => update({ connectionName: event.target.value })}
        >
          {connections.map((connection) => (
            <MenuItem key={connection.name} value={connection.name}>
              {connection.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControlLabel
        control={
          <Checkbox
            checked={value.manualTargetEnabled}
            disabled={disabled || !provider.resolveManualTarget}
            onChange={(event) => update({ manualTargetEnabled: event.target.checked })}
          />
        }
        label={mergedLabels.manualTarget}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
          label={mergedLabels.host}
          value={
            value.manualTargetEnabled ? value.manualHost : (selectedConnection?.hostLabel ?? '')
          }
          disabled={disabled || !value.manualTargetEnabled || !value.useCorsProxy}
          onChange={(event) => update({ manualHost: event.target.value })}
        />
        <TextField
          label={mergedLabels.port}
          value={
            value.manualTargetEnabled ? value.manualPort : (selectedConnection?.portLabel ?? '')
          }
          disabled={disabled || !value.manualTargetEnabled || !value.useCorsProxy}
          onChange={(event) => update({ manualPort: event.target.value })}
          sx={{ width: { xs: '100%', sm: 160 } }}
        />
      </Stack>
      <FormControlLabel
        control={
          <Checkbox
            checked={value.useCorsProxy}
            disabled={disabled || !value.manualTargetEnabled}
            onChange={(event) => update({ useCorsProxy: event.target.checked })}
          />
        }
        label={mergedLabels.corsProxy}
      />
      <Box aria-live="polite">
        <Typography variant="caption" color="text.secondary">
          {mergedLabels.health}
        </Typography>
        <Typography variant="body2">{health.status}</Typography>
      </Box>
      {children?.({ persistedValue, health })}
    </Stack>
  );
}
