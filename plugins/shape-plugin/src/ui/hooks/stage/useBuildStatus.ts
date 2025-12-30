import { useMemo } from 'react';
import type { BuildStatus } from '@hierarchidb/components';
import type { ShapeProgressStatus } from '../useShapeProgress.js';
import { useTranslation } from '../../i18n.js';

type Options = {
  forcePaused?: boolean;
};

export const useBuildStatus = (
  status: ShapeProgressStatus | null,
  options: Options = {},
): { buildStatus: BuildStatus; statusLabel: string; effectiveStatus: ShapeProgressStatus | null } => {
  const { t } = useTranslation();
  const effectiveStatus = useMemo(() => {
    if (!status) return status;
    if (options.forcePaused && status.status === 'processing') {
      return { ...status, status: 'paused' as const };
    }
    return status;
  }, [options.forcePaused, status]);

  const buildStatus: BuildStatus = useMemo(() => {
    switch (effectiveStatus?.status) {
      case 'idle':
        return 'idle';
      case 'processing':
        return 'running';
      case 'paused':
        return 'paused';
      case 'failed':
        return 'failed';
      case 'completed':
        return 'completed';
      default:
        return 'idle';
    }
  }, [effectiveStatus]);

  const statusLabel = useMemo(() => {
    switch (effectiveStatus?.status) {
      case 'idle':
        return t('stage.status.ready', 'Ready to start stage');
      case 'processing':
        return t('stage.status.running', 'Build in progress');
      case 'paused':
        return t('stage.status.paused', 'Build paused');
      case 'completed':
        return t('stage.status.completed', 'Build completed');
      case 'failed':
        return t('stage.status.failed', 'Build failed');
      default:
        return t('stage.status.ready', 'Ready to start stage');
    }
  }, [effectiveStatus, t]);

  return { buildStatus, statusLabel, effectiveStatus };
};
