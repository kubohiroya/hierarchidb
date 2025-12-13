import type { StylerDialogData } from '@hierarchidb/styler-plugin/common/types/StylerEntity.ts';
import type { SpreadSheetDataSourceType } from '@hierarchidb/spreadsheet-plugin';
import { useTranslation } from 'react-i18next';
import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Typography } from '@mui/material';
import { ModalSelect } from '@hierarchidb/ui-modal-select';

export const StyleMappingSourcePanel = ({
                                          pluginData,
                                          handleKeyColumnChange,
                                          menuContainer,
                                          columns,
                                          handleValueColumnChange,
                                        }: {
  pluginData: StylerDialogData & {
    dataSource?: SpreadSheetDataSourceType;
    colorScheme?: string;
  },
  handleKeyColumnChange: (keyColumn: string) => void,
  menuContainer: Element | null,
  columns: string[],
  handleValueColumnChange: (valueColumn: string) => void
}) => {
  const { t } = useTranslation('styler-plugin');
  return <Box sx={{ display: 'flex', mb: 2, flexDirection: 'row', gap: 3 }}>
    <Typography variant="subtitle1" sx={{ mb: 1 }}>
      {t('styleSettings.source.label', 'Source Columns')}
    </Typography>
    <FormControl required>
      <InputLabel htmlFor={'keyColumn'}>{t('styleSettings.keyColumn.label', 'Property key source')}</InputLabel>
      <ModalSelect
        name={'keyColumn'}
        value={pluginData.mapping?.keyColumn ?? ''}
        label={t('styleSettings.keyColumn.label', 'Column as property key source')}
        onChange={(event) => handleKeyColumnChange(event.target.value)}
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
      <FormHelperText>{t('styleSettings.keyColumn.help')}</FormHelperText>
    </FormControl>

    <FormControl required>
      <InputLabel htmlFor={'valueColumn'}>{t('styleSettings.valueColumn.label', 'Property value source')}</InputLabel>
      <ModalSelect
        name={'valueColumn'}
        value={pluginData.mapping?.valueColumn ?? ''}
        label={t('styleSettings.valueColumn.label', 'Column as property value source')}
        onChange={(event) => handleValueColumnChange(event.target.value)}
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
      <FormHelperText>{t('styleSettings.valueColumn.help')}</FormHelperText>
    </FormControl>
  </Box>;

};
