import React from 'react';
import { Box, Collapse, IconButton, Typography, SxProps, Theme } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

export interface CollapsibleSectionProps {
  /** Section title */
  title?: string;
  /** Whether the section is initially collapsed */
  defaultCollapsed?: boolean;
  /** Whether the section can be collapsed */
  collapsible?: boolean;
  /** Custom collapse icon */
  collapseIcon?: React.ReactNode;
  /** Custom expand icon */
  expandIcon?: React.ReactNode;
  /** Position of the toggle button */
  togglePosition?: 'start' | 'end';
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Content to display */
  children: React.ReactNode;
  /** Custom styles */
  sx?: SxProps<Theme>;
  /** Custom styles for the header */
  headerSx?: SxProps<Theme>;
  /** Custom styles for the content */
  contentSx?: SxProps<Theme>;
  /** Whether to show a border */
  bordered?: boolean;
  /** Padding size */
  padding?: 'none' | 'small' | 'medium' | 'large';
  /** Animation duration in ms */
  animationDuration?: number;
}

const paddingSizes = {
  none: 0,
  small: 1,
  medium: 2,
  large: 3,
};

/**
 * A simple collapsible section without the full accordion styling
 * Useful for inline collapsible content
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultCollapsed = false,
  collapsible = true,
  collapseIcon = <ExpandLess />,
  expandIcon = <ExpandMore />,
  togglePosition = 'end',
  onCollapseChange,
  children,
  sx,
  headerSx,
  contentSx,
  bordered = false,
  padding = 'medium',
  animationDuration = 300,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const handleToggle = () => {
    if (!collapsible) return;
    const newState = !collapsed;
    setCollapsed(newState);
    onCollapseChange?.(newState);
  };

  const toggleButton = collapsible && (
    <IconButton
      size="small"
      onClick={handleToggle}
      sx={{ ml: togglePosition === 'end' ? 'auto' : 0 }}
    >
      {collapsed ? expandIcon : collapseIcon}
    </IconButton>
  );

  return (
    <Box
      sx={{
        border: bordered ? 1 : 0,
        borderColor: 'divider',
        borderRadius: bordered ? 1 : 0,
        ...sx,
      }}
    >
      {(title || collapsible) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: paddingSizes[padding],
            cursor: collapsible ? 'pointer' : 'default',
            '&:hover': collapsible ? {
              bgcolor: 'action.hover',
            } : {},
            ...headerSx,
          }}
          onClick={collapsible ? handleToggle : undefined}
        >
          {togglePosition === 'start' && toggleButton}
          {title && (
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              {title}
            </Typography>
          )}
          {togglePosition === 'end' && toggleButton}
        </Box>
      )}
      
      <Collapse in={!collapsed} timeout={animationDuration}>
        <Box
          sx={{
            p: paddingSizes[padding],
            ...contentSx,
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};