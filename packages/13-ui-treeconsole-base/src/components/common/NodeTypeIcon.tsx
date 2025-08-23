/**
 * NodeTypeIcon - ノードタイプに応じたアイコン表示コンポーネント
 *
 * クリック可能で、コンテキストメニューを表示できる
 */

import { MouseEvent } from 'react';
import { IconButton, Box } from '@mui/material';
import {
  Folder as FolderIcon,
  Description as FileIcon,
  Note as NoteIcon,
  Home as HomeIcon,
  Delete as TrashIcon,
} from '@mui/icons-material';

interface NodeTypeIconProps {
  nodeType: string;
  size?: 'small' | 'medium' | 'large';
  clickable?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
}

/**
 * ノードタイプに応じたアイコンを返す
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
 * NodeTypeIcon コンポーネント
 */
export function NodeTypeIcon({
  nodeType,
  size = 'small',
  clickable = false,
  onClick,
  disabled = false,
  color = 'inherit',
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
        <Icon fontSize={fontSize} color={color} />
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
      <Icon fontSize={fontSize} color={color} />
    </Box>
  );
}
