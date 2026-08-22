import type React from 'react';
import { useCallback } from 'react';

interface UseSettingsAccordionViewParams {
  icon: React.ReactNode;
  showSettingsIcon: boolean;
  hasChanges: boolean;
  customActions?: React.ReactNode;
  onSave?: () => void;
  onReset?: () => void;
}

interface UseSettingsAccordionViewResult {
  showDefaultSettingsIcon: boolean;
  hasChanges: boolean;
  hasSaveAction: boolean;
  hasResetAction: boolean;
  hasHeaderActions: boolean;
  isSaveDisabled: boolean;
  handleSaveClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleResetClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function useSettingsAccordionView({
  icon,
  showSettingsIcon,
  hasChanges,
  customActions,
  onSave,
  onReset,
}: UseSettingsAccordionViewParams): UseSettingsAccordionViewResult {
  const handleSaveClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSave?.();
    },
    [onSave]
  );

  const handleResetClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onReset?.();
    },
    [onReset]
  );

  return {
    showDefaultSettingsIcon: showSettingsIcon && !icon,
    hasChanges,
    hasSaveAction: Boolean(onSave),
    hasResetAction: Boolean(onReset),
    hasHeaderActions: Boolean(onSave || onReset || customActions),
    isSaveDisabled: !hasChanges,
    handleSaveClick,
    handleResetClick,
  };
}
