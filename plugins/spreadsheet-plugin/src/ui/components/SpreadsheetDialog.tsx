import React from 'react';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import type { UseSpreadsheetDialogOptions } from '../hooks/useSpreadsheetDialog.js';
import { useSpreadsheetDialog } from '../hooks/useSpreadsheetDialog.js';

export const SpreadsheetDialog: React.FC<UseSpreadsheetDialogOptions> = (props) => {
  const { frameStyle, dialogRef, headlessProps } = useSpreadsheetDialog(props);

  return (
    <div style={frameStyle} role="dialog" aria-modal={props.open} ref={dialogRef}>
      <HeadlessMultiStepDialog<SpreadsheetEntity> {...headlessProps} />
    </div>
  );
};

SpreadsheetDialog.displayName = 'SpreadsheetDialog';
