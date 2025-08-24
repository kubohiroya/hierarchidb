import React from 'react';
import { StyledAccordion, StyledAccordionProps } from '../components/StyledAccordion';
import { Settings, Save, Restore } from '@mui/icons-material';
import { IconButton, Tooltip, Box } from '@mui/material';

export interface SettingsAccordionProps extends Omit<StyledAccordionProps, 'headerActions'> {
  /** Whether to show settings icon */
  showSettingsIcon?: boolean;
  /** Whether this contains unsaved changes */
  hasChanges?: boolean;
  /** Callback for save action */
  onSave?: () => void;
  /** Callback for reset action */
  onReset?: () => void;
  /** Custom actions to display */
  customActions?: React.ReactNode;
  /** Save button tooltip */
  saveTooltip?: string;
  /** Reset button tooltip */
  resetTooltip?: string;
}

/**
 * Accordion designed for settings/configuration sections
 * Includes save/reset actions and change indicators
 */
export const SettingsAccordion: React.FC<SettingsAccordionProps> = ({
  showSettingsIcon = true,
  hasChanges = false,
  onSave,
  onReset,
  customActions,
  saveTooltip = 'Save changes',
  resetTooltip = 'Reset to defaults',
  icon,
  ...accordionProps
}) => {
  const headerActions = React.useMemo(() => {
    const actions = [];
    
    if (onSave) {
      actions.push(
        <Tooltip key="save" title={saveTooltip}>
          <span>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              disabled={!hasChanges}
              color={hasChanges ? 'primary' : 'default'}
            >
              <Save fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      );
    }
    
    if (onReset) {
      actions.push(
        <Tooltip key="reset" title={resetTooltip}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            <Restore fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    }
    
    if (customActions) {
      actions.push(
        <React.Fragment key="custom">
          {customActions}
        </React.Fragment>
      );
    }
    
    return actions.length > 0 ? (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {actions}
      </Box>
    ) : null;
  }, [hasChanges, onSave, onReset, customActions, saveTooltip, resetTooltip]);

  const settingsIcon = showSettingsIcon && !icon ? <Settings /> : icon;

  return (
    <StyledAccordion
      {...accordionProps}
      icon={settingsIcon}
      headerActions={headerActions}
      sx={{
        ...(hasChanges && {
          borderLeft: '3px solid',
          borderLeftColor: 'warning.main',
        }),
        ...accordionProps.sx,
      }}
    />
  );
};