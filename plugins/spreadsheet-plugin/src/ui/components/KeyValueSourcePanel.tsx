import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Typography } from '@mui/material';
import { ModalSelect } from '@hierarchidb/ui-modal-select';
import { useTranslation } from '@hierarchidb/ui-i18n';

export interface KeyValueSourcePanelProps {
  keyColumn?: string;
  valueColumn?: string;
  columns: string[];
  menuContainer: Element | null;
  onKeyColumnChange: (keyColumn: string) => void;
  onValueColumnChange: (valueColumn: string) => void;
  translationNamespace?: string;
}

export const KeyValueSourcePanel = ({
  keyColumn,
  valueColumn,
  columns,
  menuContainer,
  onKeyColumnChange,
  onValueColumnChange,
  translationNamespace = 'spreadsheet-plugin',
}: KeyValueSourcePanelProps) => {
  const { t } = useTranslation(translationNamespace);

  return (
    <Box sx={{ display: 'flex', mb: 2, flexDirection: 'row', gap: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {t('styleSettings.source.label', 'Source Columns')}
      </Typography>

      <FormControl required>
        <InputLabel htmlFor="keyColumn">
          {t('styleSettings.keyColumn.label', 'Property key source')}
        </InputLabel>
        <ModalSelect
          name="keyColumn"
          value={keyColumn ?? ''}
          label={t('styleSettings.keyColumn.label', 'Column as property key source')}
          onChange={(event) => onKeyColumnChange(event.target.value)}
          menuContainer={menuContainer}
          usePortal={false}
          menuZIndexOffset={200}
        >
          <MenuItem value="">
            <em>{t('styleSettings.keyColumn.none', 'Select a column')}</em>
          </MenuItem>
          {columns.map((col: string) => (
            <MenuItem key={col} value={col}>
              {col}
            </MenuItem>
          ))}
        </ModalSelect>
        <FormHelperText>{t('styleSettings.keyColumn.help', 'Select the column that contains the key')}</FormHelperText>
      </FormControl>

      <FormControl required>
        <InputLabel htmlFor="valueColumn">
          {t('styleSettings.valueColumn.label', 'Property value source')}
        </InputLabel>
        <ModalSelect
          name="valueColumn"
          value={valueColumn ?? ''}
          label={t('styleSettings.valueColumn.label', 'Column as property value source')}
          onChange={(event) => onValueColumnChange(event.target.value)}
          menuContainer={menuContainer}
          usePortal={false}
          menuZIndexOffset={200}
        >
          <MenuItem value="">
            <em>{t('styleSettings.valueColumn.none', 'Select a column')}</em>
          </MenuItem>
          {columns.map((col: string) => (
            <MenuItem key={col} value={col}>
              {col}
            </MenuItem>
          ))}
        </ModalSelect>
        <FormHelperText>{t('styleSettings.valueColumn.help', 'Select the column that contains the value')}</FormHelperText>
      </FormControl>
    </Box>
  );
};
