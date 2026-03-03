import React from 'react';
import { StyledAccordion, type StyledAccordionProps } from '~/components/StyledAccordion';
import { Restore, Save, Settings } from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useSettingsAccordionView } from './useSettingsAccordionView.js';

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
  const {
    showDefaultSettingsIcon,
    hasChanges: hasPendingChanges,
    hasSaveAction,
    hasResetAction,
    hasHeaderActions,
    isSaveDisabled,
    handleSaveClick,
    handleResetClick,
  } = useSettingsAccordionView({
    icon,
    showSettingsIcon,
    hasChanges,
    customActions,
    onSave,
    onReset,
  });
  const settingsIcon = showDefaultSettingsIcon ? <Settings /> : icon;
  const headerActions = hasHeaderActions ? (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {hasSaveAction ? (
        <Tooltip title={saveTooltip}>
          <span>
            <IconButton
              size="small"
              onClick={handleSaveClick}
              disabled={isSaveDisabled}
              color={hasPendingChanges ? 'primary' : 'default'}
            >
              <Save fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      {hasResetAction ? (
        <Tooltip title={resetTooltip}>
          <IconButton
            size="small"
            onClick={handleResetClick}
          >
            <Restore fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      {customActions ?? null}
    </Box>
  ) : null;

  return (
    <StyledAccordion
      {...accordionProps}
      icon={settingsIcon}
      headerActions={headerActions}
      sx={{
        ...(hasPendingChanges && {
          borderLeft: '3px solid',
          borderLeftColor: 'warning.main',
        }),
        ...accordionProps.sx,
      }}
    />
  );
};
