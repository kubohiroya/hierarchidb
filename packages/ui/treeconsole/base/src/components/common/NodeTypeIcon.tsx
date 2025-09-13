/**
  * NodeTypeIcon -
    */

import { MouseEvent } from 'react';
import { Box, IconButton } from '@mui/material';
import {
  Delete as TrashIcon,
  Description as FileIcon,
  Folder as FolderIcon,
  Home as HomeIcon,
  Note as NoteIcon,
} from '@mui/icons-material';

interface NodeTypeIconProps {
  nodeType: string;
  size?: 'small' | 'medium' | 'large';
  clickable?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
  /** Optional explicit svg color (hex or css). */
  htmlColor?: string;
}

/**
    */
function getIconByType(nodeType: string) {
  switch (nodeType) {
    case 'ProjectFolder':
    case 'ResourceFolder':
    case 'folder':
      return FolderIcon;
    case 'file':
      return FileIcon;
    case 'note':
      return NoteIcon;
    case 'ProjectsRoot':
    case 'ResourcesRoot':
      return HomeIcon;
    case 'ProjectsTrashRoot':
    case 'ResourcesTrashRoot':
      return TrashIcon;
    default:
      return FolderIcon;
  }
}

/**
  * NodeTypeIcon
  */
export function NodeTypeIcon({
                               nodeType,
                               size = 'small',
                               clickable = false,
                               onClick,
                               disabled = false,
                               color = 'inherit',
                               htmlColor,
                             }: NodeTypeIconProps) {
  const Icon = getIconByType(nodeType);
  const fontSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';

  if (clickable && onClick) {
    return (
      <IconButton
        size={size}
        onClick={onClick}
        disabled={disabled}
        sx={{
          padding: size === 'small' ? 0.5 : 1,
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <Icon fontSize={fontSize} color={color} htmlColor={htmlColor} />
      </IconButton>
    );
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size === 'small' ? 20 : size === 'large' ? 28 : 24,
        height: size === 'small' ? 20 : size === 'large' ? 28 : 24,
      }}
    >
      <Icon fontSize={fontSize} color={color} htmlColor={htmlColor} />
    </Box>
  );
}
