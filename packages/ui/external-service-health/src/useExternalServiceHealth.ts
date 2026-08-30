import { useEffect, useRef, useState } from 'react';
import type {
  ExternalServiceHealthChecker,
  ExternalServiceHealthResult,
} from './externalServiceHealthTypes.js';

export const INCOMPLETE_EXTERNAL_SERVICE_HEALTH: ExternalServiceHealthResult = {
  status: 'incomplete',
};

export function useExternalServiceHealth<TInput>({
  checker,
  value,
  debounceMs = 300,
  unavailableCode = 'SERVICE_UNAVAILABLE',
}: {
  readonly checker: ExternalServiceHealthChecker<TInput>;
  readonly value: TInput | null;
  readonly debounceMs?: number;
  readonly unavailableCode?: string;
}): ExternalServiceHealthResult {
  const [health, setHealth] = useState<ExternalServiceHealthResult>(
    INCOMPLETE_EXTERNAL_SERVICE_HEALTH
  );
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (value === null) {
      sequenceRef.current += 1;
      setHealth(INCOMPLETE_EXTERNAL_SERVICE_HEALTH);
      return;
    }

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      setHealth({ status: 'checking' });
      checker
        .checkHealth(value, controller.signal)
        .then((result) => {
          if (sequenceRef.current !== sequence || controller.signal.aborted) return;
          setHealth({
            status: result.status,
            checkedAt: result.checkedAt ?? Date.now(),
            code: result.code,
          });
        })
        .catch(() => {
          if (sequenceRef.current !== sequence || controller.signal.aborted) return;
          setHealth({ status: 'unhealthy', checkedAt: Date.now(), code: unavailableCode });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [checker, debounceMs, unavailableCode, value]);

  return health;
}
