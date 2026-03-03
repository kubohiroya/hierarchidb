import { useCallback, useState } from 'react';

export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export const DISPLAY_MODE_LABELS: Record<DialogDisplayMode, string> = {
  normal: 'Normal (通常)',
  maximize: 'Maximize (最大)',
  'full-screen': 'Full-screen (全画面)',
};

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
  const [modeMenuAnchor, setModeMenuAnchor] = useState<HTMLElement | null>(null);

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
    [closeModeMenu, onChangeDisplayMode],
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
    maximizeToggleLabel: displayMode === 'maximize' ? DISPLAY_MODE_LABELS.normal : DISPLAY_MODE_LABELS.maximize,
    fullscreenToggleLabel:
      displayMode === 'full-screen' ? DISPLAY_MODE_LABELS.normal : DISPLAY_MODE_LABELS['full-screen'],
    openModeMenu,
    closeModeMenu,
    selectDisplayMode,
    toggleMaximize,
    toggleFullscreen,
  };
}
