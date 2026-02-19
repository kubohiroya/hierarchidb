import { notify } from '@hierarchidb/components';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clearAppIndexedDBsViaPlugins } from '~/plugin-runtime/clearIndexedDb';
import { logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

type IndexedDbResetArgs = {
  developerModeEnabled: boolean;
  resetWorker: () => void;
  initializeWorker: () => Promise<void>;
  navigate: (args: { to: string; replace?: boolean }) => void;
};

export function useIndexedDbReset({
  developerModeEnabled,
  resetWorker,
  initializeWorker,
  navigate,
}: IndexedDbResetArgs) {
  const { t } = useTranslation('common');

  const refreshWorkerRuntime = useCallback(() => {
    try {
      resetWorker();
    } catch (error) {
      logIntegrationWarning('Failed to reset worker after IndexedDB clear', error);
    }
    void initializeWorker().catch((error) => {
      logIntegrationWarning('Failed to reinitialize worker after IndexedDB clear', error);
    });
  }, [initializeWorker, resetWorker]);

  const handleIndexedDbReset = useCallback(async () => {
    if (!developerModeEnabled) return;
    const confirmMessage =
      t('treeConsole.toolbar.developerMenu.clearIndexedDbConfirm', {
        defaultValue: 'Delete all IndexedDB data created by this app?',
      }) ?? '';
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }
    try {
      try {
        resetWorker();
      } catch (error) {
        logIntegrationWarning('Failed to reset worker before IndexedDB clear', error);
      }
      const result = await clearAppIndexedDBsViaPlugins();
      const shouldRefreshWorker = result.invoked.length > 0;
      if (shouldRefreshWorker) {
        refreshWorkerRuntime();
      }
      if (result.errors.length > 0) {
        logIntegrationWarning('IndexedDB clear encountered errors', result.errors);
        notify.error(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbFailure', {
            defaultValue: 'Failed to delete IndexedDB data. See console for details.',
          })
        );
        return;
      }
      if (result.invoked.length > 0) {
        notify.success(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbSuccess', {
            defaultValue: 'Deleted IndexedDB data created by this app.',
          })
        );
      } else if (result.missing.length === 0) {
        notify.info(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbEmpty', {
            defaultValue: 'No IndexedDB databases were found for this app.',
          })
        );
      }
      navigate({ to: '/', replace: true });
    } catch (error) {
      logIntegrationWarning('Failed to clear IndexedDB', error);
      notify.error(
        t('treeConsole.toolbar.developerMenu.clearIndexedDbFailure', {
          defaultValue: 'Failed to delete IndexedDB data. See console for details.',
        })
      );
    }
  }, [developerModeEnabled, navigate, refreshWorkerRuntime, resetWorker, t]);

  return { handleIndexedDbReset };
}
