import { Box, LinearProgress, Typography } from '@mui/material';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type StepName = 'Config' | 'Theme' | 'I18n' | 'Auth' | 'UI' | 'Worker';

export type BootStep = {
  name: StepName;
  weight: number; // relative weight for overall progress
  progress: number; // 0-100
  message?: string;
  done: boolean;
};

type BootProgressContextValue = {
  steps: Record<StepName, BootStep>;
  setStepProgress: (name: StepName, progress: number, message?: string) => void;
  markStepDone: (name: StepName, message?: string) => void;
  isStepDone: (name: StepName) => boolean;
  overallProgress: number; // 0-100
  isAllDone: boolean;
};

const defaultSteps: BootStep[] = [
  { name: 'Config', weight: 5, progress: 0, done: false },
  { name: 'Theme', weight: 5, progress: 0, done: false },
  { name: 'I18n', weight: 10, progress: 0, done: false },
  { name: 'Auth', weight: 10, progress: 0, done: false },
  { name: 'UI', weight: 10, progress: 0, done: false },
  { name: 'Worker', weight: 60, progress: 0, done: false },
];

const BootProgressContext = createContext<BootProgressContextValue | null>(null);

export const useBootProgress = (): BootProgressContextValue => {
  const ctx = useContext(BootProgressContext);
  if (!ctx) throw new Error('useBootProgress must be used within BootProgressProvider');
  return ctx;
};

export const useOptionalBootProgress = (): BootProgressContextValue | null => {
  return useContext(BootProgressContext);
};

export const BootProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Record<StepName, BootStep>>(() => {
    const base = Object.fromEntries(defaultSteps.map((s) => [s.name, { ...s }])) as Record<
      StepName,
      BootStep
    >;
    // Persisted flags to survive remounts during dev/hydration
    const bootWindow = typeof window !== 'undefined' ? (window as BootWindow) : undefined;
    if (bootWindow?.__HDB_INIT_COMPLETE__) {
      base.Worker.progress = 100;
      base.Worker.done = true;
      base.Worker.message = 'Worker ready';
    }
    return base;
  });
  // guard to ensure we only force worker-done once (Rules of Hooks: declare at top level)
  const workerForcedRef = useRef(false);

  const setStepProgress = useCallback((name: StepName, progress: number, message?: string) => {
    setSteps((prev) => {
      const cur = prev[name];
      if (!cur) return prev;
      // If already done, ignore further updates to avoid churn from multiple sources
      if (cur.done) return prev;
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      const nextDone = cur.done || clamped >= 100;
      const nextMsg = message ?? cur.message;
      // Bail out if nothing actually changes
      if (cur.progress === clamped && cur.done === nextDone && cur.message === nextMsg) {
        return prev;
      }
      const next = { ...prev } as typeof prev;
      next[name] = { ...cur, progress: clamped, done: nextDone, message: nextMsg };

      return next;
    });
  }, []);

  const markStepDone = useCallback(
    (name: StepName, message?: string) => {
      // If already done, avoid redundant updates
      if (steps[name]?.done) return;

      setStepProgress(name, 100, message);
    },
    [steps, setStepProgress]
  );

  const isStepDone = useMemo(() => (name: StepName) => steps[name]?.done === true, [steps]);

  const overallProgress = useMemo(() => {
    const list = Object.values(steps);
    const totalWeight = list.reduce((sum, s) => sum + s.weight, 0) || 1;
    const acc = list.reduce((sum, s) => sum + (s.weight * (s.progress || 0)) / 100, 0);
    return Math.round((acc / totalWeight) * 100);
  }, [steps]);

  const isAllDone = overallProgress >= 100 && Object.values(steps).every((s) => s.done);
  const overallLoggedRef = useRef(false);
  useEffect(() => {
    if (overallProgress === 100 && !overallLoggedRef.current) {
      overallLoggedRef.current = true;
    }
    if (overallProgress < 100 && overallLoggedRef.current) {
      // reset if progress regresses (dev hot updates)
      overallLoggedRef.current = false;
    }
  }, [overallProgress]);

  const value: BootProgressContextValue = useMemo(
    () => ({
      steps,
      setStepProgress,
      markStepDone,
      isStepDone,
      overallProgress,
      isAllDone,
    }),
    [steps, setStepProgress, markStepDone, isStepDone, overallProgress, isAllDone]
  );

  // Global worker-done fail-safe: if INIT_COMPLETE is already set globally or event fires,
  // ensure Step Worker becomes done even if reporter timing races.
  useEffect(() => {
    const forceDone = () => {
      if (workerForcedRef.current) return;
      setSteps((prev) => {
        if (prev.Worker?.done) return prev;
        const next = { ...prev } as typeof prev;
        next.Worker = {
          ...prev.Worker,
          progress: 100,
          done: true,
          message: prev.Worker.message || 'Worker ready',
        };

        return next;
      });
      workerForcedRef.current = true;
    };
    const maybeDone = () => {
      if ((window as BootWindow).__HDB_INIT_COMPLETE__) forceDone();
    };
    maybeDone();
    const onEvt = () => {
      forceDone();
    };
    window.addEventListener('hierarchidb-worker-init-complete', onEvt, { once: true });
    const t = window.setInterval(maybeDone, 200);
    return () => {
      window.removeEventListener('hierarchidb-worker-init-complete', onEvt);
      window.clearInterval(t);
    };
  }, []);

  return (
    <BootProgressContext.Provider value={value}>
      <BootOverlay />
      {children}
    </BootProgressContext.Provider>
  );
};

// Determinate overlay that follows staged init
const BootOverlay: React.FC = () => {
  const { overallProgress, isAllDone, steps } = useBootProgress();
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const lastLogRef = useRef<number>(-1);
  const lastMsgRef = useRef<string>('');

  useEffect(() => {}, []);

  useEffect(() => {
    // Hide overlay when either all steps are done, or at least Worker is done (temporary gating)
    const ready = isAllDone || Boolean(steps?.Worker?.done);
    if (ready) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setVisible(false), 100);
    }
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [isAllDone, steps?.Worker?.done]);

  const currentMessage = (() => {
    // Show the first step that is not yet 100, else show last completed
    const list = Object.values(steps);
    const firstPending = list.find((s) => s.progress < 100);
    return firstPending?.message || firstPending?.name || 'Initializing...';
  })();

  // Throttled progress logging (every 10%)
  useEffect(() => {
    const p = overallProgress;
    const m = currentMessage || '';
    if (
      p === 0 ||
      p === 100 ||
      Math.abs(p - (lastLogRef.current || 0)) >= 10 ||
      m !== lastMsgRef.current
    ) {
      lastLogRef.current = p;
      lastMsgRef.current = m;
    }
  }, [overallProgress, currentMessage]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        padding: 4,
        zIndex: 2000,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          {overallProgress}% Complete
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          display="block"
          sx={{ mt: 1 }}
        >
          {currentMessage}
        </Typography>
      </Box>
    </Box>
  );
};

// StageGate renders children only when all dependsOn steps are done
export const StageGate: React.FC<{ dependsOn: StepName[]; children: React.ReactNode }> = ({
  dependsOn,
  children,
}) => {
  const { isStepDone } = useBootProgress();
  const ok = dependsOn.every(isStepDone);
  const openedRef = React.useRef(false);
  React.useEffect(() => {
    if (ok && !openedRef.current) {
      openedRef.current = true;
    }
  }, [ok, dependsOn]);
  return ok ? <>{children}</> : null;
};
type BootWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};
