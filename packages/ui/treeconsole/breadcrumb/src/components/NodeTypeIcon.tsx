/**
  * NodeTypeIcon -
     */

import type { MouseEvent, ReactElement } from 'react';
import { Box, IconButton } from '@mui/material';
import {
  Delete as ArchiveIcon,
  Description as FileIcon,
  Folder as FolderIcon,
  Home as HomeIcon,
  Note as NoteIcon,
  Public as PublicIcon,
  Hexagon as HexagonIcon,
  Place as PlaceIcon,
  AltRoute as AltRouteIcon,
  Assessment as AssessmentIcon,
  Palette as PaletteIcon,
  Extension as ExtensionIcon,
  AccountTree as AccountTreeIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

interface NodeTypeIconProps {
  nodeType: string;
  size?: 'small' | 'medium' | 'large' | string;
  clickable?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
  /**
   * Optional explicit color (hex or css color). When provided,
   * the underlying SvgIcon uses it via htmlColor while keeping
   * MUI color prop as 'inherit'.
   */
  htmlColor?: string;
}

/**
    */
function getIconByType(nodeType: string) {
  switch (nodeType) {
    // Known HierarchiDB node types
    case 'project':
      return AccountTreeIcon;
    case 'basemap':
      return PublicIcon;
    case 'shape':
      return HexagonIcon;
    case 'location':
      return PlaceIcon;
    case 'route':
      return AltRouteIcon;
    case 'spreadsheet':
      return AssessmentIcon;
    case 'styler':
      return PaletteIcon;
    case 'resolver':
      return ExtensionIcon;
    case 'linker':
    case 'linker-plugin':
      return AccountTreeIcon;
    case 'timeline':
    case 'timeline-plugin':
      return AccessTimeIcon;
    case 'ProjectFolder':
    case 'ResourceFolder':
    case 'folder-plugin':
      return FolderIcon;
    case 'file':
      return FileIcon;
    case 'note':
      return NoteIcon;
    case 'ProjectsRoot':
    case 'ResourcesRoot':
      return HomeIcon;
    case 'ProjectsArchiveRoot':
    case 'ResourcesArchiveRoot':
      return ArchiveIcon;
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
                             }: NodeTypeIconProps): ReactElement {
  // Handle both standard sizes and string size
  const standardSizes = ['small', 'medium', 'large'];
  const iconSize = standardSizes.includes(size) ? (size as 'small' | 'medium' | 'large') : 'small';

  // Fallback to default icon
  const Icon = getIconByType(nodeType);
  const fontSize = iconSize === 'small' ? 'small' : iconSize === 'large' ? 'large' : 'medium';

  if (clickable && onClick) {
    return (
      <IconButton
        size={iconSize}
        onClick={onClick}
        disabled={disabled}
        sx={{
          padding: iconSize === 'small' ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'context-menu',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        {/* Keep color as 'inherit' so htmlColor takes effect when provided */}
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
        width: iconSize === 'small' ? 20 : iconSize === 'large' ? 28 : 24,
        height: iconSize === 'small' ? 20 : iconSize === 'large' ? 28 : 24,
      }}
    >
      {/* Keep color as 'inherit' so htmlColor takes effect when provided */}
      <Icon fontSize={fontSize} color={color} htmlColor={htmlColor} />
    </Box>
  );
}
