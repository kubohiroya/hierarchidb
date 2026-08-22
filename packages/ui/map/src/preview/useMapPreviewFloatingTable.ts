import { useMemo } from 'react';
import type {
  MapPreviewErrorColumnLabels,
  MapPreviewFloatingTableProps,
  MapPreviewStatusLabels,
} from './MapPreviewFloatingTable.js';

export const useMapPreviewFloatingTable = <Row extends { id: string | number }>({
  statusLabels,
  errorColumnLabels,
  formatErrorMessage,
}: Pick<
  MapPreviewFloatingTableProps<Row>,
  'statusLabels' | 'errorColumnLabels' | 'formatErrorMessage'
>) => {
  const resolvedStatusLabels: MapPreviewStatusLabels = statusLabels ?? {
    completed: 'Completed',
    failed: 'Failed',
  };
  const resolvedErrorLabels: MapPreviewErrorColumnLabels | null = errorColumnLabels ?? null;
  const resolvedFormatMessage = useMemo(
    () =>
      formatErrorMessage ??
      ((summary: { messages: string[] }) => summary.messages.slice(0, 2).join(' / ')),
    [formatErrorMessage]
  );

  return {
    resolvedStatusLabels,
    resolvedErrorLabels,
    resolvedFormatMessage,
  };
};
