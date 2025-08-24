import React from 'react';
import { Box, Typography, Divider, SxProps, Theme } from '@mui/material';
import { BaseAccordion, BaseAccordionProps } from './BaseAccordion';

export interface AccordionGroupItem extends Omit<BaseAccordionProps, 'children'> {
  /** Unique key for the accordion */
  key: string;
  /** Content for this accordion */
  content: React.ReactNode;
}

export interface GroupedAccordionProps {
  /** Group title */
  title?: string;
  /** Group description */
  description?: string;
  /** Array of accordion items */
  items: AccordionGroupItem[];
  /** Whether only one accordion can be expanded at a time */
  exclusive?: boolean;
  /** Initially expanded items (keys) */
  defaultExpanded?: string[];
  /** Callback when any accordion changes */
  onExpansionChange?: (expandedKeys: string[]) => void;
  /** Custom styles for the group container */
  sx?: SxProps<Theme>;
  /** Custom styles for the group header */
  headerSx?: SxProps<Theme>;
  /** Whether to show dividers between accordions */
  showDividers?: boolean;
  /** Gap between accordions */
  spacing?: number;
}

/**
 * A group of related accordions with optional exclusive expansion
 */
export const GroupedAccordion: React.FC<GroupedAccordionProps> = ({
  title,
  description,
  items,
  exclusive = false,
  defaultExpanded = [],
  onExpansionChange,
  sx,
  headerSx,
  showDividers = false,
  spacing = 2,
}) => {
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const handleAccordionChange = (key: string, expanded: boolean) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      
      if (exclusive && expanded) {
        // Clear all other expansions if exclusive mode
        newSet.clear();
        newSet.add(key);
      } else if (expanded) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      
      const keysArray = Array.from(newSet);
      onExpansionChange?.(keysArray);
      return newSet;
    });
  };

  return (
    <Box sx={sx}>
      {(title || description) && (
        <Box sx={{ mb: 3, ...headerSx }}>
          {title && (
            <Typography variant="h5" component="h2" gutterBottom>
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
        {items.map((item, index) => (
          <React.Fragment key={item.key}>
            {showDividers && index > 0 && <Divider />}
            <BaseAccordion
              {...item}
              defaultExpanded={expandedKeys.has(item.key)}
              onExpansionChange={(expanded) => handleAccordionChange(item.key, expanded)}
            >
              {item.content}
            </BaseAccordion>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};