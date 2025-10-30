import { useEffect } from 'react';
import { useBootProgress } from '../contexts/BootProgressProvider.js';
import { useTranslation } from 'react-i18next';
import { useSimpleBFFAuth } from '@hierarchidb/ui-shell/ui-auth';
import { useWorker } from '../contexts/WorkerProvider.js';

const logInitReporterWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[InitReporters]', message, error);
};

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
  }, [i18n?.isInitialized, markStepDone, setStepProgress]);
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
  }, [isLoading, markStepDone, setStepProgress]);
  return null;
};

export const WorkerProgressReporter: React.FC = () => {
  const { setStepProgress, markStepDone } = useBootProgress();
  const { initProgress, isInitialized, initMessage } = useWorker();
  // Reflect Provider progress
  useEffect(() => {
    setStepProgress('Worker', initProgress || 0, initMessage || 'Worker initializing');
    if (isInitialized) markStepDone('Worker', 'Worker ready');
  }, [initProgress, isInitialized, initMessage, setStepProgress, markStepDone]);

  // Fallbacks: event and polling
  useEffect(() => {
    const onEvt = () => {
      markStepDone('Worker', 'Worker ready');
    };
    window.addEventListener('hierarchidb-worker-init-complete', onEvt, { once: true });
    // Immediate check on mount
    try {
      if ((window as InitStatusWindow).__HDB_INIT_COMPLETE__) {
        markStepDone('Worker', 'Worker ready');
      }
    } catch (error) {
      logInitReporterWarning('Failed to inspect __HDB_INIT_COMPLETE__ flag', error);
    }
    const t = window.setInterval(() => {
      // Late import to avoid circular
      import('../WorkerAPIClient.ts').then(({ WorkerAPIClient }) => {
        if (WorkerAPIClient.isReady()) {
          markStepDone('Worker', 'Worker ready');
          window.clearInterval(t);
        }
      }).catch((error) => {
        logInitReporterWarning('Failed to poll WorkerAPIClient readiness', error);
      });
    }, 200);
    return () => {
      window.removeEventListener('hierarchidb-worker-init-complete', onEvt);
      window.clearInterval(t);
    };
  }, [markStepDone]);
  return null;
};
type InitStatusWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};
