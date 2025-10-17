import { useCallback } from 'react';
import type { ShapeBatchCommand, ShapeBatchCommandPayload } from '../../common/shared/index.js';
import { useShapeAPIGetter } from './useShapeAPI.js';

export function useShapeBatchCommand() {
  const getShapeAPI = useShapeAPIGetter();

  return useCallback(async <K extends ShapeBatchCommand>(command: K, payload: ShapeBatchCommandPayload<K>) => {
    const api = await getShapeAPI();

    if (typeof api.invokeBatchCommand === 'function') {
      await api.invokeBatchCommand(command, payload);
      return;
    }

    // Legacy fallback paths for session-level commands (requires workingCopyId)
    if (!payload.workingCopyId) {
      throw new Error('Legacy shape batch command requires workingCopyId in payload');
    }

    switch (command) {
      case 'session/pause':
        await api.pauseBatchProcessing(payload.workingCopyId);
        break;
      case 'session/resume':
        await api.resumeBatchProcessing(payload.workingCopyId);
        break;
      case 'session/cancel':
        await api.cancelBatchProcessing(payload.workingCopyId);
        break;
      default:
        throw new Error(`Command ${command as string} not supported in legacy fallback`);
    }
  }, [getShapeAPI]);
}
