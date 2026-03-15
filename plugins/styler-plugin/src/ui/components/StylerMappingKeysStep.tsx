import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { KeyValueSourcePanel } from '@hierarchidb/spreadsheet-plugin/ui';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { Box, FormControl, FormHelperText, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { StylerStepData } from '~/common/types/StylerEntity';

const coerceColumns = (
  metadata?: TabularTableMetadata | null,
  previewColumns?: unknown[] | null
): string[] => {
  const fromMetadata = (metadata?.columns ?? [])
    .map((col) => (typeof col === 'string' ? col : col?.name))
    .filter((name): name is string => Boolean(name));

  const fromPreview =
    Array.isArray(previewColumns) && previewColumns.length > 0
      ? previewColumns
          .map((col, index) => {
            if (typeof col === 'string') return col;
            if (col && typeof col === 'object' && 'name' in col) {
              const name = (col as { name?: string }).name;
              if (typeof name === 'string' && name.trim()) return name;
            }
            return `col_${index}`;
          })
          .filter(Boolean)
      : [];

  return Array.from(new Set([...fromMetadata, ...fromPreview]));
};

export const StylerMappingKeysStep: React.FC<PluginStepProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('styler-plugin');
  const columns = useMemo(
    () =>
      coerceColumns(
        data?.tabularTableMetadata as TabularTableMetadata | undefined,
        data?.lastPreview?.columns ?? null
      ),
    [data?.lastPreview?.columns, data?.tabularTableMetadata]
  );
  const keyColumn = data?.keyColumn ?? '';
  const valueColumn = data?.valueColumn ?? '';
  const featureIdProperty = data?.mapping?.featureIdProperty ?? '';
  const placeholderText = t('step3.featureIdProperty.placeholder', 'e.g. iso2, gid_1, portCode');
  const placeholder =
    typeof placeholderText === 'string' && placeholderText.length > 0
      ? placeholderText
      : 'e.g. iso2, gid_1, portCode';
  const menuContainer = (dialogRef?.current as Element | null) ?? null;
  const lastValidity = useRef<boolean | null>(null);
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    const valid = Boolean(keyColumn && valueColumn && featureIdProperty);
    if (lastValidity.current !== valid) {
      lastValidity.current = valid;
      setValid(valid);
    }
    const errorMessage = valid
      ? null
      : t(
          'step3.validation.required',
          'Select key/value columns and enter the feature ID property.'
        );
    if (lastError.current !== errorMessage) {
      lastError.current = errorMessage;
      setError(errorMessage);
    }
  }, [featureIdProperty, keyColumn, setError, setValid, t, valueColumn]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1">
        {t(
          'step3.description',
          'Choose the table columns and the tile feature ID to link styling values.'
        )}
      </Typography>
      <KeyValueSourcePanel
        keyColumn={keyColumn}
        valueColumn={valueColumn}
        columns={columns}
        menuContainer={menuContainer}
        onKeyColumnChange={(nextKey: string) =>
          onChange({
            ...(data ?? {}),
            keyColumn: nextKey,
            mapping: { ...(data?.mapping ?? {}), keyColumn: nextKey },
          } as StylerStepData)
        }
        onValueColumnChange={(nextValue: string) =>
          onChange({
            ...(data ?? {}),
            valueColumn: nextValue,
            mapping: { ...(data?.mapping ?? {}), valueColumn: nextValue },
          } as StylerStepData)
        }
        translationNamespace="styler-plugin"
      />
      <FormControl>
        <TextField
          label={t('step3.featureIdProperty.label', 'Feature ID Property')}
          value={featureIdProperty}
          onChange={(event) =>
            onChange({
              ...(data ?? {}),
              mapping: { ...(data?.mapping ?? {}), featureIdProperty: event.target.value },
            } as StylerStepData)
          }
          placeholder={placeholder}
        />
        <FormHelperText>
          {t(
            'step3.featureIdProperty.help',
            'The property name on the vector tile feature used for promoteId and feature-atoms lookup.'
          )}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};
