import type { SelectionMatrixColumn, SelectionMatrixRow } from '@hierarchidb/components';
import type { PrimitiveAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import type { Country } from '~/types/Country';

type UseCountryMatrixTableModelParams = {
  rows: SelectionMatrixRow<{ country: Country; sourceIndex: number }>[];
  selectionColumns: SelectionMatrixColumn[];
  matrixStateAtom: PrimitiveAtom<boolean[][]>;
  isCellEnabledWrapper: (
    row: SelectionMatrixRow<{ country: Country }>,
    column: SelectionMatrixColumn
  ) => boolean;
};

export const useCountryMatrixTableModel = ({
  rows,
  selectionColumns,
  matrixStateAtom,
  isCellEnabledWrapper,
}: UseCountryMatrixTableModelParams) => {
  const matrixState = useAtomValue(matrixStateAtom);

  const rowsWithTooltip = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        tooltip: row.data.country.name,
      })),
    [rows]
  );

  const columnHeaderState = useMemo(() => {
    return selectionColumns.map((column, colIndex) => {
      let enabled = 0;
      let selected = 0;
      rows.forEach((row, rowIndex) => {
        if (!isCellEnabledWrapper(row as SelectionMatrixRow<{ country: Country }>, column)) {
          return;
        }
        enabled += 1;
        if (matrixState[rowIndex]?.[colIndex]) selected += 1;
      });
      return {
        checked: enabled > 0 && selected === enabled,
        indeterminate: enabled > 0 && selected > 0 && selected < enabled,
      };
    });
  }, [isCellEnabledWrapper, matrixState, rows, selectionColumns]);

  return {
    matrixState,
    rowsWithTooltip,
    columnHeaderState,
  };
};
