/**
 * TreeConsoleSpeedDialToBeRefactored - プラグインベースのSpeedDialメニュー
 * 
 * プラグインから動的に作成オプションを生成し、
 * descriptionをツールチップとして表示
 */

import { useState, useMemo } from 'react';
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as FolderIcon,
  Note as NoteIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';

// 仮のプラグイン型定義（実際の実装では@hierarchidb/worker/registryから取得）
interface PluginDefinition {
  nodeType: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  priority?: number;
}

interface TreeConsoleSpeedDialProps {
  plugins?: PluginDefinition[];
  onCreate?: (nodeType: string) => void;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  hidden?: boolean;
}

/**
 * MUIアイコン名から実際のアイコンコンポーネントを取得
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
      // 絵文字またはデフォルトアイコン
      if (emoji) {
        return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
      }
      return <AddIcon />;
  }
}

/**
 * プラグインベースのSpeedDialメニュー
 */
export function TreeConsoleSpeedDial({
  plugins = [],
  onCreate,
  position = { bottom: 16, right: 16 },
  hidden = false,
}: TreeConsoleSpeedDialProps) {
  const [open, setOpen] = useState(false);

  // プラグインを優先度順にソート
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
        
        // descriptionがある場合はツールチップとして表示
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
              // ツールチップを長めに表示
              '& .MuiTooltip-tooltip': {
                maxWidth: 300,
                fontSize: '0.875rem',
              },
            }}
            FabProps={{
              size: 'medium',
              color: 'default',
            }}
            // descriptionがある場合は長めのツールチップを表示
            tooltipOpen={plugin.description ? undefined : false}
            tooltipPlacement="left"
          />
        );
      })}
    </SpeedDial>
  );
}

/**
 * デフォルトのプラグイン設定例
 */
export const defaultPlugins: PluginDefinition[] = [
  {
    nodeType: 'folder',
    name: 'Folder',
    displayName: 'Folder',
    description: 'Create a folder to organize your items. Folders can contain other folders and various node types.',
    icon: {
      muiIconName: 'Folder',
      emoji: '📁',
      color: '#ffa726',
    },
    priority: 1,
  },
  {
    nodeType: 'basemap',
    name: 'BaseMap',
    displayName: 'Base Map',
    description: 'Configure and manage map layers with various styles and visualization options. Supports multiple map providers.',
    icon: {
      muiIconName: 'Map',
      emoji: '🗺️',
      color: '#1976d2',
    },
    priority: 10,
  },
  {
    nodeType: 'stylemap',
    name: 'StyleMap',
    displayName: 'Style Map',
    description: 'Define and manage CSV-based styling rules for map visualization. Apply data-driven styles to your map features.',
    icon: {
      muiIconName: 'Palette',
      emoji: '🎨',
      color: '#9c27b0',
    },
    priority: 20,
  },
  {
    nodeType: 'shape',
    name: 'Shape',
    displayName: 'Geographic Shape',
    description: 'Manage geographic shape data and boundaries. Import and visualize country, state, and administrative boundaries.',
    icon: {
      muiIconName: 'Layers',
      emoji: '🌍',
      color: '#ff5722',
    },
    priority: 30,
  },
];