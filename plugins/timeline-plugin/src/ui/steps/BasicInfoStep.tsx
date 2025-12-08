import { Box, TextField } from '@mui/material';
import { useTranslation } from '../../common/i18n/index.js';

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
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={t('basic.name', 'Name')}
        size="small"
        value={values.name}
        onChange={(e) => onChange({ ...values, name: e.target.value })}
        required
      />
      <TextField
        label={t('basic.description', 'Description')}
        size="small"
        value={values.description || ''}
        onChange={(e) => onChange({ ...values, description: e.target.value })}
        multiline
        minRows={2}
      />
    </Box>
  );
}
