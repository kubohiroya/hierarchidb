import { Folder as FolderIconMUI, FolderOpen } from '@mui/icons-material';
import React from 'react';

export interface FolderIconProps {
  /**
   * Whether to show the folder as open/expanded
   */
  open?: boolean;
  /**
   * Additional CSS class name
   */
  className?: string;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
}

/**
 * Folder icon component that can show open/closed states
 */
export const FolderIcon: React.FC<FolderIconProps> = ({ open = false, ...props }) => {
  const IconComponent = open ? FolderOpen : FolderIconMUI;
  return <IconComponent {...props} />;
};
