import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import type { FolderExportDraftData } from './types.js';
import { normalizeFolderExportDraft } from './types.js';

type Props = PluginStepProps<FolderExportDraftData>;

export const FolderExportTargetStep = ({ data, onChange, setValid, setError, disabled }: Props) => {
  const draft = normalizeFolderExportDraft(data);
  const updateDraft = (next: Partial<FolderExportDraftData>) => {
    onChange({
      ...draft,
      ...next,
    });
  };

  useEffect(() => {
    const valid = draft.targetScope === 'shapeOnly' || draft.targetScope === 'all';
    setValid(valid);
    setError(valid ? null : '対象ノードを選択してください。');
  }, [draft.targetScope, setError, setValid]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Target nodes</Typography>
      <RadioGroup
        value={draft.targetScope}
        onChange={(event) => {
          if (disabled) return;
          updateDraft({
            targetScope: event.target.value as FolderExportDraftData['targetScope'],
          });
        }}
      >
        <FormControlLabel
          value="all"
          control={<Radio />}
          label="shape/location/route を含む対象以下をすべて選択"
          disabled={disabled}
        />
        <FormControlLabel
          value="shapeOnly"
          control={<Radio />}
          label="shape のみ"
          disabled={disabled}
        />
      </RadioGroup>
    </Stack>
  );
};
