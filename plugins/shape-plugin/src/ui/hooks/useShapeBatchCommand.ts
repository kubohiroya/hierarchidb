import { useCallback } from 'react';
import type { ShapeBatchCommand, ShapeBatchCommandPayload } from '../../common/types/index.js';

export function useShapeBatchCommand() {
  return useCallback(async <K extends ShapeBatchCommand>(_command: K, _payload: ShapeBatchCommandPayload<K>) => {
    throw new Error('Shape batch command API is not available in the refactored UI yet.');
  }, []);
}
