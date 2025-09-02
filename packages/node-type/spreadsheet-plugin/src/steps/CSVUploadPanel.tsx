import React from 'react';
import { CSVProvider, CSVFileUploadStep } from '@hierarchidb/ui-csv-extract';
import type { CSVTableMetadata } from '@hierarchidb/ui-csv-extract';
import { createSpreadsheetCSVApi } from '../services';

export interface CSVUploadPanelProps {
  pluginId?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  disabled?: boolean;
  onUploaded: (meta: CSVTableMetadata) => void;
  onError: (msg: string) => void;
}

export const CSVUploadPanel: React.FC<CSVUploadPanelProps> = ({
  pluginId = 'spreadsheet',
  acceptedFileTypes,
  maxFileSize,
  disabled,
  onUploaded,
  onError,
}) => {
  const api = React.useMemo(() => createSpreadsheetCSVApi(pluginId), [pluginId]);
  return (
    <CSVProvider csvApi={api}>
      <CSVFileUploadStep
        pluginId={pluginId}
        onFileUploaded={onUploaded}
        onError={onError}
        acceptedFileTypes={acceptedFileTypes}
        maxFileSize={maxFileSize}
        disabled={disabled}
      />
    </CSVProvider>
  );
};
