/**
 * DynamicSpeedDial Component
 *
 * A SpeedDial component that dynamically loads plugins from the registry
 * and displays them as creation actions, filtered by treeId.
 */

import { useState, useMemo } from 'react';
import { SpeedDial, SpeedDialAction, SpeedDialIcon, Box } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as FolderIcon,
  Note as NoteIcon,
  Map as MapIcon,
  Palette as PaletteIcon,
  Public as PublicIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { usePluginsForTree } from '~/hooks/usePluginsForTree';
import { usePluginMenuItems } from '~/hooks/usePluginMenuItems';
import type { TreeContext } from '~/plugins/menu-builders';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { TreeId, PluginDefinition } from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';

interface DynamicSpeedDialProps {
  treeId: TreeId | undefined;
  workerClient: Remote<WorkerAPI> | null;
  onCreateAction: (action: string, node: TreeNodeData) => void;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  hidden?: boolean;
  menuContext?: TreeContext; // Optional explicit context to build items from VM
}

/**
 * Get Material-UI icon component from plugin icon definition
 */
function getIconComponent(plugin: PluginDefinition) {
  const iconName = plugin.icon?.muiIconName;
  const emoji = plugin.icon?.emoji;
  
  // First, try to use emoji if available
  if (emoji) {
    return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
  }
  
  // Then, try to match MUI icon names
  switch (iconName) {
    case 'Folder':
    case 'CreateNewFolder':
      return <FolderIcon />;
    case 'Note':
    case 'NoteAdd':
      return <NoteIcon />;
    case 'Map':
      return <MapIcon />;
    case 'Palette':
      return <PaletteIcon />;
    case 'Public':
    case 'Layers':
      return <PublicIcon />;
    case 'Extension':
      return <ExtensionIcon />;
    default:
      // Default icon for plugins without specific icons
      return <AddIcon />;
  }
}

export function DynamicSpeedDial({
  treeId,
  workerClient,
  onCreateAction,
  position = { bottom: 16, right: 16 },
  hidden = false,
  menuContext,
}: DynamicSpeedDialProps) {
  const [open, setOpen] = useState(false);

  // If menuContext is provided, build items from virtual module definitions (VM-based path)
  const vmItems = menuContext ? usePluginMenuItems(menuContext) : [];
  // Use VM path only when we actually have menu items
  const useVM = Boolean(menuContext) && vmItems.length > 0;

  // Otherwise, fallback to worker-provided plugin definitions (compatibility path)
  const { plugins, loading, error } = usePluginsForTree(treeId, workerClient);

  // Sort plugins by category group and create order
  const sortedPlugins = useMemo(() => {
    return [...plugins].sort((a, b) => {
      const aGroup = a.category?.menuGroup || 'basic';
      const bGroup = b.category?.menuGroup || 'basic';
      const aOrder = a.category?.createOrder || 999;
      const bOrder = b.category?.createOrder || 999;
      
      // Define group priority
      const groupPriority: Record<string, number> = { basic: 1, container: 2, document: 3, advanced: 4 };
      const aPriority = groupPriority[aGroup] || 999;
      const bPriority = groupPriority[bGroup] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return aOrder - bOrder;
    });
  }, [plugins]);

  const handleClose = () => setOpen(false);
  const handleToggle = () => setOpen(!open);

  const handleActionClick = (plugin: PluginDefinition) => {
    // Pass the actual nodeType directly for creation
    const action = `create:${plugin.nodeType}`;
    onCreateAction(action, {} as TreeNodeData);
    handleClose();
  };

  // VM-based click
  const handleVMActionClick = (nodeType: string) => {
    const action = `create:${nodeType}`;
    onCreateAction(action, {} as TreeNodeData);
    handleClose();
  };

  // Don't render if hidden or if there's an error
  if (hidden || (!useVM && error)) {
    return null;
  }

  // Show loading state
  if (!useVM && loading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          ...position,
          zIndex: 9999,
        }}
      >
        <SpeedDial
          ariaLabel="Loading plugins..."
          sx={{
            '& .MuiSpeedDial-fab': {
              bgcolor: 'grey.400',
              color: 'white',
            },
          }}
          icon={<SpeedDialIcon />}
          direction="up"
          open={false}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        ...position,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      data-testid="dynamic-speed-dial-container"
    >
      <SpeedDial
        ariaLabel="Create new item"
        sx={{
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
        {useVM
          ? vmItems.map((item) => (
              <SpeedDialAction
                key={item.key}
                icon={item.icon?.emoji ? (
                  <span style={{ fontSize: '1.5rem' }}>{item.icon.emoji}</span>
                ) : (
                  <AddIcon />
                )}
                tooltipTitle={item.label}
                onClick={() => handleVMActionClick(item.nodeType)}
                sx={{
                  color: item.icon?.color || 'inherit',
                  '& .MuiTooltip-tooltip': {
                    maxWidth: 300,
                    fontSize: '0.875rem',
                  },
                }}
                FabProps={{ size: 'medium', color: 'default' }}
                tooltipPlacement="left"
                data-testid={`create-${item.nodeType}-action`}
              />
            ))
          : sortedPlugins.map((plugin) => {
              const displayName = plugin.displayName || plugin.name;
              const icon = getIconComponent(plugin);
              const tooltipTitle = displayName;
              return (
                <SpeedDialAction
                  key={plugin.nodeType}
                  icon={icon}
                  tooltipTitle={tooltipTitle}
                  onClick={() => handleActionClick(plugin)}
                  sx={{
                    color: plugin.icon?.color || 'inherit',
                    '& .MuiTooltip-tooltip': {
                      maxWidth: 300,
                      fontSize: '0.875rem',
                    },
                  }}
                  FabProps={{ size: 'medium', color: 'default' }}
                  tooltipPlacement="left"
                  data-testid={`create-${plugin.nodeType}-action`}
                />
              );
            })}
      </SpeedDial>
    </Box>
  );
}
