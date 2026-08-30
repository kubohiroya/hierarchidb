import { useEffect, useRef, useState } from 'react';
import type {
  IdeGsmConnectionHealthResult,
  IdeGsmConnectionInput,
  IdeGsmConnectionRuntimeProvider,
} from './ideGsmConnectionTypes.js';

const INCOMPLETE_HEALTH: IdeGsmConnectionHealthResult = { status: 'incomplete' };

export function useIdeGsmConnectionHealth({
  provider,
  value,
  debounceMs = 300,
}: {
  readonly provider: IdeGsmConnectionRuntimeProvider;
  readonly value: IdeGsmConnectionInput | null;
  readonly debounceMs?: number;
}): IdeGsmConnectionHealthResult {
  const [health, setHealth] = useState<IdeGsmConnectionHealthResult>(INCOMPLETE_HEALTH);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (!value || value.connectionName.length === 0) {
      sequenceRef.current += 1;
      setHealth(INCOMPLETE_HEALTH);
      return;
    }

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      setHealth({ status: 'checking' });
      provider
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
          setHealth({ status: 'unhealthy', checkedAt: Date.now(), code: 'CONNECTION_UNAVAILABLE' });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [debounceMs, provider, value]);

  return health;
}
