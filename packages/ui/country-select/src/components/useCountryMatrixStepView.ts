import { useMemo } from 'react';
import type { Country } from '~/types/Country';
import type { ColumnSet, MatrixConfig, MatrixSelection } from '~/types/MatrixColumn';

export interface UseCountryMatrixStepViewParams {
  countries: Country[];
  matrixConfig: MatrixConfig | ColumnSet;
  selections: MatrixSelection[];
  minSelections: number;
}

export interface UseCountryMatrixStepViewResult {
  matrixConfig: MatrixConfig;
  stats: {
    totalCountries: number;
    selectedCountries: number;
    totalSelections: number;
    isValid: boolean;
  };
  columnSetInfo: {
    name: string;
    description: string;
    type: ColumnSet['type'];
  } | null;
  validationMessage: string;
}

export function useCountryMatrixStepView({
  countries,
  matrixConfig: rawMatrixConfig,
  selections,
  minSelections,
}: UseCountryMatrixStepViewParams): UseCountryMatrixStepViewResult {
  const matrixConfig: MatrixConfig = useMemo(() => {
    if ('type' in rawMatrixConfig) {
      return {
        columns: rawMatrixConfig.columns,
        allowBulkSelect: true,
        showColumnHeaders: true,
        showFilters: true,
        virtualization: {
          rowHeight: 56,
          overscan: 5,
        },
      };
    }
    return rawMatrixConfig;
  }, [rawMatrixConfig]);

  const stats = useMemo(() => {
    const totalCountries = countries.length;
    const selectedCountries = selections.length;
    const totalSelections = selections.reduce(
      (sum, selection) => sum + Object.values(selection.selections).filter(Boolean).length,
      0
    );

    return {
      totalCountries,
      selectedCountries,
      totalSelections,
      isValid: selectedCountries >= minSelections,
    };
  }, [countries.length, minSelections, selections]);

  const columnSetInfo = useMemo(() => {
    if ('type' in rawMatrixConfig) {
      return {
        name: rawMatrixConfig.name,
        description: rawMatrixConfig.description,
        type: rawMatrixConfig.type,
      };
    }
    return null;
  }, [rawMatrixConfig]);

  const validationMessage = `Please select at least ${minSelections} ${minSelections === 1 ? 'country' : 'countries'} to continue.`;

  return {
    matrixConfig,
    stats,
    columnSetInfo,
    validationMessage,
  };
}
