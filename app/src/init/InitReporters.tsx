import { useEffect } from 'react';
import { useBootProgress } from '~/contexts/BootProgressProvider';
import { useTranslation } from 'react-i18next';
import { useSimpleBFFAuth } from '@hierarchidb/ui-auth';
import { useWorker } from '~/contexts/WorkerProvider';

type StepName = 'Config' | 'Theme' | 'I18n' | 'Auth' | 'UI' | 'Worker';

export const MarkStepDoneOnMount: React.FC<{ step: StepName; message?: string }>
  = ({ step, message }) => {
  const { markStepDone } = useBootProgress();
  useEffect(() => {
    markStepDone(step, message);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export const ThemeReadyReporter: React.FC = () => (
  <MarkStepDoneOnMount step="Theme" message="Theme ready" />
);

export const ConfigReadyReporter: React.FC = () => (
  <MarkStepDoneOnMount step="Config" message="Config loaded" />
);

export const UIReadyReporter: React.FC = () => (
  <MarkStepDoneOnMount step="UI" message="UI plugins registered" />
);

export const I18nReadyReporter: React.FC = () => {
  const { setStepProgress, markStepDone } = useBootProgress();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (i18n?.isInitialized) {
      setStepProgress('I18n', 90, 'i18n initialized');
      markStepDone('I18n', 'i18n initialized');
    } else {
      setStepProgress('I18n', 30, 'loading i18n');
      const t = setInterval(() => {
        if (i18n?.isInitialized) {
          setStepProgress('I18n', 90, 'i18n initialized');
          markStepDone('I18n', 'i18n initialized');
          clearInterval(t);
        }
      }, 50);
      return () => clearInterval(t);
    }
  }, [i18n?.isInitialized]);
  return null;
};

export const AuthReadyReporter: React.FC = () => {
  const { setStepProgress, markStepDone } = useBootProgress();
  const { isLoading } = useSimpleBFFAuth();
  useEffect(() => {
    // When auth finished initial load (regardless of signed-in status), we mark done
    if (!isLoading) {
      setStepProgress('Auth', 90, 'Auth initialized');
      markStepDone('Auth', 'Auth initialized');
    } else {
      setStepProgress('Auth', 30, 'Auth loading');
    }
  }, [isLoading]);
  return null;
};

export const WorkerProgressReporter: React.FC = () => {
  const { setStepProgress, markStepDone } = useBootProgress();
  const { initProgress, isInitialized, initMessage } = useWorker();
  // Reflect Provider progress
  useEffect(() => {
    try { console.log('[HDB-BOOT] Reporter Worker state progress=%s initialized=%s msg=%s', initProgress, isInitialized, initMessage || ''); } catch {}
    setStepProgress('Worker', initProgress || 0, initMessage || 'Worker initializing');
    if (isInitialized) markStepDone('Worker', 'Worker ready');
  }, [initProgress, isInitialized, initMessage]);

  // Fallbacks: event and polling
  useEffect(() => {
    const onEvt = () => {
      try { console.log('[HDB-BOOT] Reporter Worker event INIT_COMPLETE'); } catch {}
      markStepDone('Worker', 'Worker ready');
    };
    try { window.addEventListener('hierarchidb-worker-init-complete', onEvt, { once: true }); } catch {}
    // Immediate check on mount
    try {
      if ((window as any).__HDB_INIT_COMPLETE__) {
        console.log('[HDB-BOOT] Reporter Worker global flag detected');
        markStepDone('Worker', 'Worker ready');
      }
    } catch {}
    const t = window.setInterval(() => {
      try {
        // Late import to avoid circular
        import('../WorkerAPIClient').then(({ WorkerAPIClient }) => {
          if (WorkerAPIClient.isReady()) {
            try { console.log('[HDB-BOOT] Reporter Worker poll isReady=true'); } catch {}
            markStepDone('Worker', 'Worker ready');
            window.clearInterval(t);
          }
        }).catch(() => {});
      } catch {}
    }, 200);
    return () => { try { window.removeEventListener('hierarchidb-worker-init-complete', onEvt); } catch {} try { window.clearInterval(t); } catch {} };
  }, [markStepDone]);
  return null;
};
