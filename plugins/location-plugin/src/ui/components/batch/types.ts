import type { BuildSessionProgressPanelProps } from '@hierarchidb/ui-build-progress';
import type React from 'react';
import type { LocationEntity, NodeId } from '~/common/types/index';

export interface BuildProgressDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
  draftData?: Partial<LocationEntity>;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  source: string;
  message: string;
}

export interface BuildProgressDialogState {
  tabValue: number;
  onTabChange: (_: React.SyntheticEvent, newValue: number) => void;
  tableId: string | null;
  datasetId: string | null;
  locale: string;
  dialogTitle: string;
  closeAriaLabel: string;
  closeLabel: string;
  progressTabLabel: string;
  logsTabLabel: string;
  mapPreviewTabLabel: string;
  dataTableTabLabel: string;
  phaseLabel: string;
  showAuthRequired: boolean;
  authAlertMessage: string;
  visibleError: string | undefined;
  logs: LogEntry[];
  logsEmptyLabel: string;
  mapPlaceholderLabel: string;
  progressPanelProps: BuildSessionProgressPanelProps;
}
