import type React from 'react';
import { BuildProgressDialogView } from './BuildProgressDialogView.js';
import type { BuildProgressDialogProps } from './types.js';
import { useBuildProgressDialogState } from './useBuildProgressDialogState.js';

export type { BuildProgressDialogProps } from './types.js';

export const BuildProgressDialog: React.FC<BuildProgressDialogProps> = (props) => {
  const state = useBuildProgressDialogState(props);
  return <BuildProgressDialogView open={props.open} onClose={props.onClose} {...state} />;
};
