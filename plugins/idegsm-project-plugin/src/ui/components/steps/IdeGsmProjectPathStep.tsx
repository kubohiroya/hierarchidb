import { assertProjectRelativePath } from '@hierarchidb/idegsm-project-api';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { Box, TextField } from '@mui/material';
import { useEffect, useMemo } from 'react';
import type { IdeGsmProjectDialogData } from '../steps-provider-types.js';

export type IdeGsmProjectPathStepProps = PluginStepProps<IdeGsmProjectDialogData>;

export function IdeGsmProjectPathStep(props: IdeGsmProjectPathStepProps) {
  const { data, disabled, onChange, setError, setValid } = props;
  const value = data.projectRelativePath ?? '';
  const validationError = useMemo(() => {
    try {
      assertProjectRelativePath(value, 'projectRelativePath');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, [value]);

  useEffect(() => {
    setValid(validationError === null);
    setError(validationError);
  }, [setError, setValid, validationError]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <TextField
        label="Project path"
        value={value}
        disabled={disabled}
        error={validationError !== null}
        helperText={validationError ?? ' '}
        fullWidth
        onChange={(event) =>
          onChange({
            ...data,
            projectRelativePath: event.target.value,
          })
        }
      />
    </Box>
  );
}
