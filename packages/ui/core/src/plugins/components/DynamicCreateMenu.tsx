import React from "react";
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import type { NodeId, CreateMenuItem } from "@hierarchidb/common-core";
import { useDynamicCreateMenu } from "../hooks/useDynamicCreateMenu";
import { NodeDataAdapter } from "../adapters/NodeDataAdapter";

export interface DynamicCreateMenuProps {
  /**
   * Parent node where new items will be created
   */
  readonly parentNodeId: NodeId;

  /**
   * Anchor element for the menu
   */
  readonly anchorEl: HTMLElement | null;

  /**
   * Whether the menu is open
   */
  readonly open: boolean;

  /**
   * Called when the menu should be closed
   */
  readonly onClose: () => void;

  /**
   * Called when a create action is triggered
   */
  readonly onCreate: (parentNodeId: NodeId, nodeType: string) => void;

  /**
   * Node data adapter for fetching data
   */
  readonly nodeAdapter: NodeDataAdapter;

  /**
   * Menu positioning configuration
   */
  readonly positioning?: {
    readonly anchorOrigin?: {
      readonly vertical: "top" | "center" | "bottom";
      readonly horizontal: "left" | "center" | "right";
    };
    readonly transformOrigin?: {
      readonly vertical: "top" | "center" | "bottom";
      readonly horizontal: "left" | "center" | "right";
    };
  };
}

/**
 * Dynamic Create Menu Component
 *
 * Renders a context-aware menu of items that can be created in the specified parent node.
 * The menu items are dynamically output based on:
 * - Available UI plugins
 * - Parent node capabilities
 * - User permissions
 * - Worker layer restrictions
 */
export const DynamicCreateMenu: React.FC<DynamicCreateMenuProps> = ({
  parentNodeId,
  anchorEl,
  open,
  onClose,
  onCreate,
  nodeAdapter,
  positioning = {
    anchorOrigin: { vertical: "bottom", horizontal: "left" },
    transformOrigin: { vertical: "top", horizontal: "left" },
  },
}) => {
  const { menuItems, loading, error } = useDynamicCreateMenu(
    parentNodeId,
    nodeAdapter,
  );

  const handleItemClick = (nodeType: string) => {
    onCreate(parentNodeId, nodeType);
    onClose();
  };

  // Loading state
  if (loading) {
    return (
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={positioning.anchorOrigin}
        transformOrigin={positioning.transformOrigin}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <CircularProgress size={16} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    );
  }

  // Error state
  if (error) {
    return (
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={positioning.anchorOrigin}
        transformOrigin={positioning.transformOrigin}
      >
        <MenuItem disabled>
          <ListItemText>
            <Alert severity="error" sx={{ py: 0 }}>
              {error}
            </Alert>
          </ListItemText>
        </MenuItem>
      </Menu>
    );
  }

  // Empty state
  if (menuItems.length === 0) {
    return (
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={positioning.anchorOrigin}
        transformOrigin={positioning.transformOrigin}
      >
        <MenuItem disabled>
          <ListItemText>
            <Typography variant="body2" color="text.secondary">
              No items can be created here
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    );
  }

  // Render menu items
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={positioning.anchorOrigin}
      transformOrigin={positioning.transformOrigin}
      slotProps={{
        paper: {
          elevation: 8,
          sx: {
            minWidth: 200,
            maxWidth: 300,
          },
        },
      }}
    >
      {menuItems.map((item, index) => {
        // Render divider
        if ("type" in item && item.type === "divider") {
          return <Divider key={`divider-${index}`} />;
        }

        // Render menu item (CreateMenuItem)
        const createItem = item as CreateMenuItem;
        const IconComponent = createItem.icon as React.ComponentType<{
          fontSize?: string;
        }>;

        return (
          <MenuItem
            key={createItem.nodeType || `item-${index}`}
            onClick={() => handleItemClick(createItem.nodeType!)}
            sx={{
              "& .MuiListItemIcon-root": {
                minWidth: 36,
              },
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <ListItemIcon>
              {IconComponent && <IconComponent fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={createItem.label}
              secondary={createItem.description}
              primaryTypographyProps={{
                variant: "body2",
                fontWeight: 500,
              }}
              secondaryTypographyProps={{
                variant: "caption",
                color: "text.secondary",
                sx: {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          </MenuItem>
        );
      })}
    </Menu>
  );
};

DynamicCreateMenu.displayName = "DynamicCreateMenu";

/**
 * Simplified version for quick integration
 */
export interface SimpleDynamicCreateMenuProps {
  readonly parentNodeId: NodeId;
  readonly anchorEl: HTMLElement | null;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreate: (parentNodeId: NodeId, nodeType: string) => void;
  readonly nodeAdapter: NodeDataAdapter;
}

export const SimpleDynamicCreateMenu: React.FC<SimpleDynamicCreateMenuProps> = (
  props,
) => {
  return <DynamicCreateMenu {...props} />;
};
