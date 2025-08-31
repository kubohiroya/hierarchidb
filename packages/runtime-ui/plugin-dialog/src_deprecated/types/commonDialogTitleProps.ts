import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/esm/styles/index';

/**
 * Common dialog title props
 */
export interface CommonDialogTitleProps {
  /**
   * Dialog title text
   */
  title: string;

  /**
   * Optional icon
   */
  icon?: ReactNode;

  /**
   * Optional subtitle/description
   */
  description?: string;

  /**
   * Whether to show draft indicator
   */
  showDraftChip?: boolean;

  /**
   * Called when close button is clicked
   */
  onClose?: () => void;

  /**
   * Additional sx props
   */
  sx?: SxProps<Theme>;
}
