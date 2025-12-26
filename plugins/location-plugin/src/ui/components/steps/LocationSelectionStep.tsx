/**
 * Location Selection Step
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Alert, Box } from '@mui/material';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { LocationType } from '../../../common/types/index.js';
import { CountryMatrixSelector, useIsoCountries, type MatrixConfig, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { BASE_LOCATION_TYPES, resolveTypesForSource } from './locationTypes.js';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({ draft, onUpdate }) => {
  const { translations, t } = useTranslation();
  const iso = useIsoCountries();
  const allowedTypes = resolveTypesForSource(draft.dataSource ?? '');
  const allowedTypeSet = new Set(allowedTypes);
  const typeDescriptions = translations.selection?.typeDescriptions ?? {};

  const matrixConfig: MatrixConfig = {
    columns: BASE_LOCATION_TYPES.map((type) => {
      const name = translations.locationTypes?.[type.id] ?? type.id;
      const description = typeDescriptions[type.id as keyof typeof typeDescriptions] ?? name;
      return {
        id: type.id,
        label: `${type.icon} ${name}`,
        description,
        type: 'custom',
        width: 140,
      };
    }),
    virtualization: {
      rowHeight: 40,
      overscan: 8,
    },
  };

  const deepEqualSelectionRecord = (
    current: Record<string, boolean[]>,
    next: Record<string, boolean[]>,
  ): boolean => {
    if (iso.status !== 'ready') return true;
    for (const country of iso.countries) {
      const rowA = current[country.code] ?? [];
      const rowB = next[country.code] ?? [];
      if (rowA.length !== rowB.length) return false;
      for (let j = 0; j < rowA.length; j += 1) {
        if (rowA[j] !== rowB[j]) return false;
      }
    }
    return true;
  };

  type CountryMatrixSelection = MatrixSelection;

  const selectionByCountries = draft.selectedArrayByCountries ?? {};

  const selectionMatrixSource = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country) => selectionByCountries[country.code] ?? []);
  }, [iso, selectionByCountries]);

  const selectionRecordSource = useMemo(() => {
    if (iso.status !== 'ready') return {};
    return selectionByCountries;
  }, [iso, selectionByCountries]);

  const currentSelections: CountryMatrixSelection[] = useMemo(() => {
    if (iso.status !== 'ready') return [];
    return iso.countries.map((country, index) => {
      const row = selectionMatrixSource[index] ?? [];
      const selections: Record<string, boolean> = {};
      matrixConfig.columns.forEach((col, colIdx) => {
        selections[col.id] = Boolean(row[colIdx]);
      });
      return { countryCode: country.code, selections };
    });
  }, [iso, selectionMatrixSource, matrixConfig.columns]);

  const applySelections = useCallback(
    (nextSelections: CountryMatrixSelection[]) => {
      if (iso.status !== 'ready') return;
      const normalized: Record<string, boolean[]> = {};
      iso.countries.forEach((country) => {
        const entry = nextSelections.find((sel) => sel.countryCode === country.code);
        const selections = entry?.selections ?? {};
        normalized[country.code] = matrixConfig.columns.map((col) => {
          const allowed = allowedTypeSet.has(col.id as LocationType);
          return allowed ? Boolean(selections[col.id]) : false;
        });
      });

      if (allowedTypes.length === 1) {
        const sole = allowedTypes[0];
        const soleIndex = matrixConfig.columns.findIndex((c) => c.id === sole);
        if (soleIndex >= 0) {
          Object.values(normalized).forEach((row) => {
            row[soleIndex] = true;
          });
        }
      }

      if (!deepEqualSelectionRecord(selectionRecordSource, normalized)) {
        onUpdate({ selectedArrayByCountries: normalized });
      }
    },
    [allowedTypeSet, allowedTypes, iso, matrixConfig.columns, onUpdate, selectionRecordSource],
  );

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('selection.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('selection.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('selection.emptyCountries', 'No countries available. Please try again later.')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <CountryMatrixSelector
        countries={iso.countries}
        matrixConfig={matrixConfig}
        selections={currentSelections}
        onSelectionsChange={applySelections}
        showAlphabetIndex
        showRegionIndex
        rowHeight={40}
        isCellEnabled={(_, columnId) => allowedTypeSet.has(columnId as LocationType)}
        height="100%"
        maxHeight={undefined}
      />
    </Box>
  );
};
