import type { PluginStepProps } from '@hierarchidb/plugin-base';
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';
import type { FolderExportDraftData } from './types.js';
import { normalizeFolderExportDraft } from './types.js';

type Props = PluginStepProps<FolderExportDraftData>;

export const FolderExportFormatStep = ({ data, onChange, setValid, setError, disabled }: Props) => {
  const draft = normalizeFolderExportDraft(data);
  const isContinuity = draft.exportMode === 'continuity';
  const updateDraft = (next: Partial<FolderExportDraftData>) => {
    onChange({
      ...draft,
      ...next,
    });
  };

  useEffect(() => {
    if (isContinuity) {
      if (draft.format !== 'json') {
        onChange({
          ...draft,
          format: 'json',
        });
      }
    }

    const valid =
      isContinuity ||
      draft.format === 'pbf.zip' ||
      draft.format === 'mvf' ||
      draft.format === 'json';
    setValid(valid);
    setError(valid ? null : '形式を選択してください。');
  }, [draft.format, isContinuity, onChange, setError, setValid]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Output format</Typography>
      {isContinuity ? (
        <Typography variant="body2">作業継続用途は内部継続形式の json を採用します。</Typography>
      ) : null}
      <FormControl>
        <FormLabel>形式</FormLabel>
        <RadioGroup
          value={draft.format}
          onChange={(event) => {
            if (disabled || isContinuity) return;
            updateDraft({
              format: event.target.value as FolderExportDraftData['format'],
            });
          }}
        >
          <FormControlLabel
            value="pbf.zip"
            control={<Radio />}
            label="pbf.zip"
            disabled={disabled || isContinuity}
          />
          <FormControlLabel
            value="mvf"
            control={<Radio />}
            label="mvf"
            disabled={disabled || isContinuity}
          />
        </RadioGroup>
      </FormControl>
    </Stack>
  );
};
