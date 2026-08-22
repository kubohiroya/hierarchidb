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

export const FolderExportPurposeStep = ({
  data,
  onChange,
  setValid,
  setError,
  disabled,
}: Props) => {
  const draft = normalizeFolderExportDraft(data);
  const updateDraft = (next: Partial<FolderExportDraftData>) => {
    onChange({
      ...draft,
      ...next,
    });
  };

  useEffect(() => {
    setValid(draft.exportMode === 'continuity' || draft.exportMode === 'distribution');
    setError(draft.exportMode ? null : '目的を選択してください。');
  }, [draft.exportMode, setError, setValid]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Export purpose</Typography>
      <FormControl>
        <FormLabel>用途を選択</FormLabel>
        <RadioGroup
          value={draft.exportMode}
          onChange={(event) => {
            if (disabled) return;
            updateDraft({
              exportMode: event.target.value as FolderExportDraftData['exportMode'],
            });
          }}
        >
          <FormControlLabel
            value="continuity"
            control={<Radio />}
            label="作業継続（Import continuity）"
            disabled={disabled}
          />
          <FormControlLabel
            value="distribution"
            control={<Radio />}
            label="外部配信用（External distribution）"
            disabled={disabled}
          />
        </RadioGroup>
      </FormControl>
    </Stack>
  );
};
