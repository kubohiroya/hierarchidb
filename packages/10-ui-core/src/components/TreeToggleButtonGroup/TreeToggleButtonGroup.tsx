/**
 * @file TreeToggleButtonGroup.tsx
 * @description Flexible button group for toggling between multiple tree pages
 */

import React from 'react';
import { Button, ButtonGroup, ButtonProps, Tooltip } from '@mui/material';
// import { SvgIconComponent } from '@mui/icons-material';

// @ts-ignore - react-router not available in ui-core
const useNavigate = () => (_path: string, _options?: any) => {}; // Placeholder until moved to proper package
// @ts-ignore - react-router not available in ui-core
const useLoaderData = () => ({}); // Placeholder until moved to proper package

export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'small' | 'medium' | 'large';

/**
 * Tree configuration for button group
 */
export interface TreeConfig {
  /** Unique identifier for the tree */
  id: string;
  /** Display label for the button */
  label: string;
  /** Icon component to display */
  icon: React.ComponentType<any>;
  /** Route path segment (e.g., 'r' for resources, 'p' for projects) */
  routePath: string;
  /** MUI color for the button */
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  /** Tooltip text (defaults to label if not provided) */
  tooltip?: string;
  /** Whether this tree option is disabled */
  disabled?: boolean;
}

/**
 * Props for TreeToggleButtonGroup
 */
export interface TreeToggleButtonGroupProps {
  /** Array of tree configurations */
  trees: TreeConfig[];
  /** Currently selected tree ID (null for neutral state) */
  selectedTreeId: string | null;
  /** Current page node ID to preserve */
  currentPageNodeId?: string;
  /** App prefix for routing (optional, only needed if not using React Router basename) */
  appPrefix?: string;
  /** Callback to get saved page node ID for a given tree */
  getSavedPageNodeId: (treeId: string) => string | null;
  /** Callback to save page node ID for a given tree */
  savePageNodeId: (treeId: string, pageNodeId: string) => void;
  /** Optional callback to validate which tree a node belongs to */
  getNodeTreeId?: (pageNodeId: string) => Promise<string | null>;
  /** Button group orientation */
  orientation?: ButtonGroupOrientation;
  /** Button size */
  size?: ButtonGroupSize;
  /** Whether to show button labels on small screens */
  showLabelsOnSmallScreens?: boolean;
  /** Custom styles for the button group */
  sx?: any;
  /** Callback when a tree is selected */
  onTreeSelect?: (treeId: string) => void;
}

/**
 * Flexible tree toggle button group component
 */
export function TreeToggleButtonGroup({
  trees,
  selectedTreeId,
  currentPageNodeId,
  appPrefix: _appPrefix = '',
  getSavedPageNodeId,
  savePageNodeId,
  getNodeTreeId,
  orientation = 'horizontal',
  size = 'medium',
  showLabelsOnSmallScreens = false,
  sx,
  onTreeSelect,
}: TreeToggleButtonGroupProps) {
  const navigate = useNavigate();

  // Safe handling of loader data that might not be available
  let pageNodeId: string | undefined;
  try {
    const loaderData = useLoaderData() as any;
    pageNodeId = loaderData?.pageNodeId;
  } catch {
    pageNodeId = undefined;
  }

  const handleToggle = async (targetTreeId: string) => {
    const targetTree = trees.find((t) => t.id === targetTreeId);
    if (!targetTree || targetTree.disabled) return;

    // Save current page node ID if we're navigating away from a selected tree
    if (selectedTreeId && targetTreeId !== selectedTreeId && currentPageNodeId) {
      // If getNodeTreeId is provided, validate the node belongs to the current tree
      if (getNodeTreeId && pageNodeId) {
        const nodeTreeId = await getNodeTreeId(pageNodeId);
        // Only save if the node belongs to the currently selected tree
        if (nodeTreeId === selectedTreeId) {
          savePageNodeId(selectedTreeId, currentPageNodeId);
        }
      } else {
        // No validation available, save directly
        savePageNodeId(selectedTreeId, currentPageNodeId);
      }
    }

    // Get saved page node ID for target tree
    const savedPageNodeId = getSavedPageNodeId(targetTreeId);

    // Navigate to target page (don't include appPrefix since it's already in basename)
    const targetPath = savedPageNodeId
      ? `/t/${targetTree.routePath}/${savedPageNodeId}`
      : `/t/${targetTree.routePath}`;

    navigate(targetPath, { replace: true });

    // Call optional callback
    onTreeSelect?.(targetTreeId);
  };

  if (trees.length === 0) {
    return null;
  }

  const buttonSx = showLabelsOnSmallScreens
    ? {}
    : {
        '& .MuiButton-startIcon': {
          marginRight: { xs: 0, sm: 0, md: 0, lg: '8px' },
        },
        minWidth: { xs: 'auto', sm: 'auto', md: 'auto', lg: '64px' },
        '& .button-text': {
          display: { xs: 'none', sm: 'none', md: 'none', lg: 'inline' },
        },
      };

  return (
    <ButtonGroup
      variant="outlined"
      size={size as ButtonProps['size']}
      orientation={orientation}
      aria-label="Switch between tree views"
      sx={{
        ...(orientation === 'vertical'
          ? {
              '& .MuiButton-root': {
                justifyContent: 'flex-start',
                textTransform: 'none',
                width: '100%',
              },
            }
          : {}),
        // Apply rounded corners
        '& .MuiButtonGroup-grouped': {
          borderRadius: '20px',
          '&:not(:last-of-type)': {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          '&:not(:first-of-type)': {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
        },
        ...sx,
      }}
    >
      {trees.map((tree) => {
        const Icon = tree.icon;
        const isSelected = selectedTreeId === tree.id;

        const button = (
          <Button
            key={tree.id}
            variant={isSelected ? 'contained' : 'outlined'}
            color={tree.color || 'primary'}
            onClick={() => handleToggle(tree.id)}
            disabled={tree.disabled}
            aria-pressed={isSelected}
            startIcon={<Icon />}
            fullWidth={orientation === 'vertical'}
            sx={buttonSx}
          >
            <span className="button-text">{tree.label}</span>
          </Button>
        );

        return tree.tooltip ? (
          <Tooltip key={tree.id} title={tree.tooltip} placement="bottom">
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </ButtonGroup>
  );
}

/**
 * Helper function to create a tree config for resources
 */
export function createResourcesTreeConfig(
  icon: React.ComponentType<any>,
  overrides?: Partial<TreeConfig>
): TreeConfig {
  return {
    id: 'resources',
    label: 'Resources',
    icon,
    routePath: 'r',
    color: 'primary',
    ...overrides,
  };
}

/**
 * Helper function to create a tree config for projects
 */
export function createProjectsTreeConfig(
  icon: React.ComponentType<any>,
  overrides?: Partial<TreeConfig>
): TreeConfig {
  return {
    id: 'projects',
    label: 'Projects',
    icon,
    routePath: 'p',
    color: 'secondary',
    ...overrides,
  };
}
