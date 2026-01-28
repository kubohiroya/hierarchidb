import { useCallback } from 'react';
import type { ShapeBuildCommand, ShapeBuildCommandPayload } from '../../../common/types/index.js';

export function useBatchCommand() {
  return useCallback(async <K extends ShapeBuildCommand>(_command: K, _payload: ShapeBuildCommandPayload<K>) => {
    throw new Error('Shape batch command API is not available in the refactored UI yet.');
  }, []);
}
