import { useMemo } from 'react';

type UseLocationPreviewListParams = {
  tableId?: string | null;
  normalizedRowsLength: number;
  loading: boolean;
  errorText?: string;
  recyclingState: 'none' | 'off' | 'on' | 'partial';
};

export const useLocationPreviewList = ({
  tableId,
  normalizedRowsLength,
  loading,
  errorText,
  recyclingState,
}: UseLocationPreviewListParams) => {
  const hasRows = normalizedRowsLength > 0;
  const shouldShowEmpty = !loading && !errorText && !tableId && !hasRows;
  const shouldShowTable = !loading && !errorText && (Boolean(tableId) || hasRows);

  const recyclingIconColor = useMemo(() => {
    if (recyclingState === 'on') return 'success' as const;
    if (recyclingState === 'partial') return 'warning' as const;
    return 'inherit' as const;
  }, [recyclingState]);

  return {
    shouldShowEmpty,
    shouldShowTable,
    recyclingDisabled: recyclingState === 'none',
    recyclingIconColor,
  };
};
