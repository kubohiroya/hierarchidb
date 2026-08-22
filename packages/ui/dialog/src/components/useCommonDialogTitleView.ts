import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useState } from 'react';

export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export interface UseCommonDialogTitleViewParams {
  displayMode: DialogDisplayMode;
  onChangeDisplayMode?: (mode: DialogDisplayMode) => void;
}

export interface UseCommonDialogTitleViewResult {
  modeMenuAnchor: HTMLElement | null;
  isModeMenuOpen: boolean;
  showMaximizeToggle: boolean;
  maximizeToggleLabel: string;
  fullscreenToggleLabel: string;
  displayModeLabels: Record<DialogDisplayMode, string>;
  displayModeAriaLabel: string;
  openModeMenu: (event: React.MouseEvent<HTMLElement>) => void;
  closeModeMenu: () => void;
  selectDisplayMode: (next: DialogDisplayMode) => void;
  toggleMaximize: () => void;
  toggleFullscreen: () => void;
}

export function useCommonDialogTitleView({
  displayMode,
  onChangeDisplayMode,
}: UseCommonDialogTitleViewParams): UseCommonDialogTitleViewResult {
  const { t } = useTranslation('common');
  const [modeMenuAnchor, setModeMenuAnchor] = useState<HTMLElement | null>(null);

  const displayModeLabels: Record<DialogDisplayMode, string> = {
    normal: String(t('dialogs.common.displayMode.normal', 'Normal (windowed)')),
    maximize: String(t('dialogs.common.displayMode.maximize', 'Maximize')),
    'full-screen': String(t('dialogs.common.displayMode.fullScreen', 'Full screen')),
  };

  const restoreLabel = String(t('dialogs.common.displayMode.restore', 'Restore'));
  const exitFullScreenLabel = String(
    t('dialogs.common.displayMode.exitFullScreen', 'Exit full screen')
  );
  const displayModeAriaLabel = String(t('dialogs.common.displayMode.ariaLabel', 'Display mode'));

  const closeModeMenu = useCallback(() => {
    setModeMenuAnchor(null);
  }, []);

  const openModeMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setModeMenuAnchor(event.currentTarget);
  }, []);

  const selectDisplayMode = useCallback(
    (next: DialogDisplayMode) => {
      onChangeDisplayMode?.(next);
      closeModeMenu();
    },
    [closeModeMenu, onChangeDisplayMode]
  );

  const toggleMaximize = useCallback(() => {
    selectDisplayMode(displayMode === 'maximize' ? 'normal' : 'maximize');
  }, [displayMode, selectDisplayMode]);

  const toggleFullscreen = useCallback(() => {
    selectDisplayMode(displayMode === 'full-screen' ? 'normal' : 'full-screen');
  }, [displayMode, selectDisplayMode]);

  return {
    modeMenuAnchor,
    isModeMenuOpen: Boolean(modeMenuAnchor),
    showMaximizeToggle: displayMode !== 'full-screen',
    maximizeToggleLabel: displayMode === 'maximize' ? restoreLabel : displayModeLabels.maximize,
    fullscreenToggleLabel:
      displayMode === 'full-screen' ? exitFullScreenLabel : displayModeLabels['full-screen'],
    displayModeLabels,
    displayModeAriaLabel,
    openModeMenu,
    closeModeMenu,
    selectDisplayMode,
    toggleMaximize,
    toggleFullscreen,
  };
}
