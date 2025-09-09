/**
  * TreeConsoleSpeedDialToBeRefactored - SpeedDial
   * description
  */

import { useMemo, useState } from 'react';
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as FolderIcon,
  Extension as ExtensionIcon,
  Note as NoteIcon,
} from '@mui/icons-material';

import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

//  UI
/*
interface CorePluginDefinition extends BasePluginDefinition {
  description?: string;
  priority?: number;
}
 */

interface TreeConsoleSpeedDialProps {
  plugins?: PluginDefinition[];
  onCreate?: (nodeType: string) => void;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  hidden?: boolean;
}

/**
  * MUI
  */
function getIconComponent(iconName?: string, emoji?: string) {
  switch (iconName) {
    case 'Folder':
    case 'CreateNewFolder':
      return <FolderIcon />;
    case 'Note':
    case 'NoteAdd':
      return <NoteIcon />;
    case 'Extension':
      return <ExtensionIcon />;
    default:
      if (emoji) {
        return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
      }
      return <AddIcon />;
  }
}

/**
  * SpeedDial
  */
export function TreeConsoleSpeedDial({
                                       plugins = [],
                                       onCreate,
                                       position = { bottom: 16, right: 16 },
                                       hidden = false,
                                     }: TreeConsoleSpeedDialProps) {
  const [open, setOpen] = useState(false);

  const sortedPlugins = useMemo(() => {
    return [...plugins].sort((a, b) => {
      const priorityA = a.priority ?? 999;
      const priorityB = b.priority ?? 999;
      return priorityA - priorityB;
    });
  }, [plugins]);

  const handleClose = () => setOpen(false);
  const handleToggle = () => setOpen(!open);

  const handleActionClick = (nodeType: string) => {
    if (onCreate) {
      onCreate(nodeType);
    }
    handleClose();
  };

  if (hidden) {
    return null;
  }

  return (
    <SpeedDial
      ariaLabel="Create new item"
      sx={{
        position: 'fixed',
        ...position,
        '& .MuiSpeedDial-fab': {
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
        },
      }}
      icon={<SpeedDialIcon />}
      direction="up"
      onClick={handleToggle}
      open={open}
      onClose={handleClose}
    >
      {sortedPlugins.map((plugin) => {
        const displayName = plugin.displayName || plugin.name;
        const icon = getIconComponent(plugin.icon?.muiIconName, plugin.icon?.emoji);

        //  description
        const tooltipTitle = plugin.description
          ? `${displayName}: ${plugin.description}`
          : displayName;

        return (
          <SpeedDialAction
            key={plugin.nodeType}
            icon={icon}
            tooltipTitle={tooltipTitle}
            onClick={() => handleActionClick(plugin.nodeType)}
            sx={{
              color: plugin.icon?.color || 'inherit',
              '& .MuiTooltip-tooltip': {
                maxWidth: 300,
                fontSize: '0.875rem',
              },
            }}
            FabProps={{
              size: 'medium',
              color: 'default',
            }}
            //  description
            tooltipOpen={plugin.description ? undefined : false}
            tooltipPlacement="left"
          />
        );
      })}
    </SpeedDial>
  );
}

/**
    */
export const defaultPlugins: Partial<PluginDefinition>[] = [
  {
    nodeType: 'folder' as NodeType,
    name: 'Folder',
    displayName: 'Folder',
    description:
      'Create a folder-plugin to organize your items. Folders can contain other folders and various node types.',
    icon: {
      muiIconName: 'Folder',
      emoji: '📁',
      color: '#ffa726',
    },
    priority: 1,
    category: {
      treeId: '*',
      menuGroup: 'basic',
    },
    database: {
      dbName: 'CoreDB',
      schema: { folders: 'id, nodeId, name' },
      version: 1,
    },
  },
  {
    nodeType: 'basemap' as NodeType,
    name: 'BaseMap',
    displayName: 'Base Map',
    description:
      'Configure and manage map layers with various styles and visualization options. Supports multiple map providers.',
    icon: {
      muiIconName: 'Map',
      emoji: '🗺️',
      color: '#1976d2',
    },
    priority: 10,
    category: {
      treeId: '*',
      menuGroup: 'document',
    },
    database: {
      dbName: 'CoreDB',
      schema: { basemaps: 'id, nodeId, name' },
      version: 1,
    },
  },
  {
    nodeType: 'styler' as NodeType,
    name: 'Styler',
    displayName: 'Style Map',
    description:
      'Define and manage CSV-based styling rules for map visualization. Apply data-driven styles to your map features.',
    icon: {
      muiIconName: 'Palette',
      emoji: '🎨',
      color: '#9c27b0',
    },
    priority: 20,
    category: {
      treeId: '*',
      menuGroup: 'document',
    },
    database: {
      dbName: 'CoreDB',
      schema: { stylers: 'id, nodeId, name' },
      version: 1,
    },
  },
  {
    nodeType: 'shape' as NodeType,
    name: 'Shape',
    displayName: 'Geographic Shape',
    description:
      'Manage geographic shape-plugin data and boundaries. Import and visualize country, state, and administrative boundaries.',
    icon: {
      muiIconName: 'Layers',
      emoji: '🌍',
      color: '#ff5722',
    },
    priority: 30,
    category: {
      treeId: '*',
      menuGroup: 'advanced',
    },
    database: {
      dbName: 'CoreDB',
      schema: { shapes: 'id, nodeId, name' },
      version: 1,
    },
  },
];
