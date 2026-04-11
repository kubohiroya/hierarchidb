/**
  * NodeTypeIcon -
     */

import type { MouseEvent, ReactElement } from 'react';
import { Badge, Box, IconButton } from '@mui/material';
import {
  Delete as ArchiveIcon,
  Description as FileIcon,
  Folder as FolderIcon,
  Home as HomeIcon,
  Note as NoteIcon,
  Public as PublicIcon,
  Hexagon as HexagonIcon,
  Place as PlaceIcon,
  Route as RouteIcon,
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
  isDraft?: boolean;
  buildRequired?: boolean;
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
      return RouteIcon;
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
  isDraft = false,
  buildRequired = false,
}: NodeTypeIconProps): ReactElement {
  // Handle both standard sizes and custom pixel string
  const standardSizes = ['small', 'medium', 'large'];
  const isCustomSize = !standardSizes.includes(size);
  const iconSize = isCustomSize ? 'small' : (size as 'small' | 'medium' | 'large');

  // Fallback to default icon
  const Icon = getIconByType(nodeType);
  const fontSize = iconSize === 'small' ? 'small' : iconSize === 'large' ? 'large' : 'medium';

  const icon = isCustomSize
    ? <Icon sx={{ fontSize: size }} color={color} htmlColor={htmlColor} />
    : <Icon fontSize={fontSize} color={color} htmlColor={htmlColor} />;

  const draftBadgeProps = isDraft
    ? {
      color: 'error' as const,
      variant: 'dot' as const,
      overlap: 'circular' as const,
      anchorOrigin: { vertical: 'top' as const, horizontal: 'right' as const },
      invisible: false,
      sx: {
        '& .MuiBadge-badge': {
          width: 8,
          height: 8,
          minWidth: 8,
          transform: 'scale(1) translate(22%, -22%) translateX(2px)',
          borderRadius: '50%',
          border: '1px solid currentColor',
        },
      },
    }
    : { invisible: true as const };

  const buildRequiredBadgeProps = buildRequired
    ? {
      color: 'default' as const,
      variant: 'dot' as const,
      overlap: 'circular' as const,
      anchorOrigin: { vertical: 'top' as const, horizontal: 'right' as const },
      invisible: false,
      sx: {
        '& .MuiBadge-badge': {
          width: isCustomSize ? 16 : 12,
          height: isCustomSize ? 16 : 12,
          minWidth: isCustomSize ? 16 : 12,
          transform: isCustomSize
            ? 'scale(1) translate(30%, -30%)'
            : 'scale(1) translate(18%, -18%) translateX(3px)',
          borderRadius: '50%',
          border: '2px solid',
          borderColor: 'warning.main',
          backgroundColor: 'transparent !important',
          boxSizing: 'border-box',
        },
      },
    }
    : { invisible: true as const };

  const withBadges = (children: ReactElement): ReactElement => {
    const withDraftBadge = isDraft ? <Badge {...draftBadgeProps}>{children}</Badge> : children;
    return buildRequired ? <Badge {...buildRequiredBadgeProps}>{withDraftBadge}</Badge> : withDraftBadge;
  };

  if (clickable && onClick) {
    return (
      withBadges(
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
          {icon}
        </IconButton>
      )
    );
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(isCustomSize
          ? { width: size, height: size }
          : {
            width: iconSize === 'small' ? 20 : iconSize === 'large' ? 28 : 24,
            height: iconSize === 'small' ? 20 : iconSize === 'large' ? 28 : 24,
          }),
      }}
    >
      {withBadges(
        isCustomSize
          ? <Icon sx={{ fontSize: size }} color={color} htmlColor={htmlColor} />
          : <Icon fontSize={fontSize} color={color} htmlColor={htmlColor} />
      )}
    </Box>
  );
}
