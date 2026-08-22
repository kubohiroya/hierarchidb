import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useEffect } from 'react';
import type { FolderExportDraftData } from './types.js';
import { normalizeFolderExportDraft } from './types.js';

type Props = PluginStepProps<FolderExportDraftData>;

const toDisplayString = (value: number): string => String(value);

const toNumberOrFallback = (value: string, fallback: number): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const FolderExportOptionsStep = ({
  data,
  onChange,
  setValid,
  setError,
  disabled,
}: Props) => {
  const draft = normalizeFolderExportDraft(data);
  const isContinuity = draft.exportMode === 'continuity';

  const updateDraft = (next: Partial<FolderExportDraftData>) => {
    onChange({
      ...draft,
      ...next,
    });
  };

  const isDistributionValid =
    draft.minZoom >= 0 &&
    draft.maxZoom >= draft.minZoom &&
    draft.maxTileBytes > 0 &&
    Number.isFinite(draft.minZoom) &&
    Number.isFinite(draft.maxZoom) &&
    Number.isFinite(draft.maxTileBytes);

  useEffect(() => {
    const valid = isContinuity || isDistributionValid;
    setValid(valid);
    setError(valid ? null : '外部配信用のオプションを確認してください。');
  }, [isContinuity, isDistributionValid, setError, setValid]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Distribution options</Typography>
      {isContinuity ? (
        <Typography variant="body2">
          作業継続用途では配信オプションを固定値として扱います。
        </Typography>
      ) : (
        <>
          <TextField
            label="minZoom"
            type="number"
            value={toDisplayString(draft.minZoom)}
            disabled={disabled}
            onChange={(event) => {
              if (disabled) return;
              updateDraft({
                minZoom: toNumberOrFallback(event.target.value, draft.minZoom),
              });
            }}
          />
          <TextField
            label="maxZoom"
            type="number"
            value={toDisplayString(draft.maxZoom)}
            disabled={disabled}
            onChange={(event) => {
              if (disabled) return;
              updateDraft({
                maxZoom: toNumberOrFallback(event.target.value, draft.maxZoom),
              });
            }}
          />
          <TextField
            label="maxTileBytes"
            type="number"
            value={toDisplayString(draft.maxTileBytes)}
            disabled={disabled}
            onChange={(event) => {
              if (disabled) return;
              updateDraft({
                maxTileBytes: toNumberOrFallback(event.target.value, draft.maxTileBytes),
              });
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.downloadPayload}
                disabled={disabled}
                onChange={(event) => {
                  if (disabled) return;
                  updateDraft({
                    downloadPayload: event.target.checked,
                  });
                }}
              />
            }
            label="downloadablePayload を含める"
          />
        </>
      )}
    </Stack>
  );
};
