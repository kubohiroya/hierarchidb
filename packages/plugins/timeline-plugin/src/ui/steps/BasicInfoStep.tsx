import { } from 'react';
import { Box, TextField } from '@mui/material';

export interface BasicInfoValues {
  name: string;
  description?: string;
}

export function BasicInfoStep({
  values,
  onChange,
}: {
  values: BasicInfoValues;
  onChange: (next: BasicInfoValues) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Name"
        size="small"
        value={values.name}
        onChange={(e) => onChange({ ...values, name: e.target.value })}
        required
      />
      <TextField
        label="Description"
        size="small"
        value={values.description || ''}
        onChange={(e) => onChange({ ...values, description: e.target.value })}
        multiline
        minRows={2}
      />
    </Box>
  );
}
