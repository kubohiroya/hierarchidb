import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  SxProps,
  Theme,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export interface BaseAccordionProps {
  /** Unique identifier */
  id?: string;
  /** Custom icon or element for the header */
  icon?: React.ReactNode;
  /** Accordion title */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Whether the accordion is expanded by default */
  defaultExpanded?: boolean;
  /** Whether the accordion is disabled */
  disabled?: boolean;
  /** Callback when expansion state changes */
  onExpansionChange?: (expanded: boolean) => void;
  /** Custom styles for the accordion */
  sx?: SxProps<Theme>;
  /** Custom styles for the header */
  headerSx?: SxProps<Theme>;
  /** Custom styles for the content */
  contentSx?: SxProps<Theme>;
  /** Background color for the header */
  headerBackgroundColor?: string;
  /** Text color for the header */
  headerTextColor?: string;
  /** Custom expand icon */
  expandIcon?: React.ReactNode;
  /** Position of the expand icon */
  expandIconPosition?: 'start' | 'end';
  /** Content to display in the accordion */
  children: React.ReactNode;
  /** Optional actions to display in the header */
  headerActions?: React.ReactNode;
  /** Whether to show a divider between header and content */
  showDivider?: boolean;
  /** Elevation level for the accordion */
  elevation?: number;
}

/**
 * Base accordion component with maximum flexibility
 * Can be used directly or extended by more specific accordion components
 */
export const BaseAccordion: React.FC<BaseAccordionProps> = ({
  id,
  icon,
  title,
  subtitle,
  defaultExpanded = false,
  disabled = false,
  onExpansionChange,
  sx,
  headerSx,
  contentSx,
  headerBackgroundColor,
  headerTextColor,
  expandIcon = <ExpandMore />,
  expandIconPosition = 'end',
  children,
  headerActions,
  showDivider = false,
  elevation = 1,
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const handleChange = (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded);
    onExpansionChange?.(isExpanded);
  };

  const headerContent = (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
      {expandIconPosition === 'start' && expandIcon}
      {icon && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
      )}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {headerActions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {headerActions}
        </Box>
      )}
      {expandIconPosition === 'end' && expandIcon}
    </Box>
  );

  return (
    <Accordion
      id={id}
      expanded={expanded}
      onChange={handleChange}
      disabled={disabled}
      elevation={elevation}
      sx={{
        '&:before': {
          display: 'none',
        },
        ...sx,
      }}
    >
      <AccordionSummary
        sx={{
          backgroundColor: headerBackgroundColor,
          color: headerTextColor,
          '& .MuiAccordionSummary-expandIconWrapper': {
            display: expandIconPosition === 'end' ? 'flex' : 'none',
          },
          ...headerSx,
        }}
      >
        {headerContent}
      </AccordionSummary>
      {showDivider && (
        <Box
          sx={{
            borderTop: 1,
            borderColor: 'divider',
          }}
        />
      )}
      <AccordionDetails sx={contentSx}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
};