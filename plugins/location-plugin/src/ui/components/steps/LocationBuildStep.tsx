import { useCallback, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { Alert, Box, Button, Typography } from '@mui/material';
import { notify } from '@hierarchidb/components';
import { listLocationPoints } from '../../../services/pointRepository.js';
import { LocationVectorTileService } from '../../../services/tiles/LocationVectorTileService.js';
import type { LocationDraft } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

type Props = {
  nodeId?: NodeId;
  draft: LocationDraft;
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;

export const LocationBuildStep: React.FC<Props> = ({ nodeId, draft: draftProp }) => {
  const { translations } = useTranslation();
  const [isBuilding, setIsBuilding] = useState(false);
  const serviceRef = useRef<LocationVectorTileService | null>(null);

  const draft = useMemo(() => draftProp.draft ?? {}, [draftProp.draft]);

  const canBuild = Boolean(
    nodeId && draftProp.treeNodeId && draft.licenseAgreement && draft.dataSource
  );

  const concurrency = useMemo(() => {
    const rawValue = Number(draft.concurrentDownloads ?? 4);
    return clamp(rawValue || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
  }, [draft.concurrentDownloads]);

  const zoomRange = useMemo(() => {
    const minZoom = clamp(Number((draft as Record<string, unknown>).tilesMinZoom ?? DEFAULT_MIN_ZOOM), 0, 24);
    const maxZoom = clamp(Number((draft as Record<string, unknown>).tilesMaxZoom ?? DEFAULT_MAX_ZOOM), minZoom, 24);
    return { minZoom, maxZoom };
  }, [draft]);

  const getService = () => {
    if (!serviceRef.current) {
      serviceRef.current = new LocationVectorTileService();
    }
    return serviceRef.current;
  };

  const handleBuild = useCallback(async () => {
    if (!nodeId) return;
    setIsBuilding(true);
    try {
      const pointsRaw = await listLocationPoints(nodeId);
      if (!pointsRaw.length) {
        notify.info(translations.build?.noPoints ?? 'No location points available to process.');
        return;
      }
      const points = pointsRaw.map((point) => ({
        lon: Number(point.longitude) || 0,
        lat: Number(point.latitude) || 0,
        id: point.pid,
        properties: {
          name: point.name,
          kind: point.kind,
          gid0: point.gid0,
          gid1: point.gid1,
          gid2: point.gid2,
          ...(point.payload ?? {}),
        },
      }));
      const settings = {
        zoomMinGenerate: zoomRange.minZoom,
        zoomMaxGenerate: zoomRange.maxZoom,
        zoomMaxServe: zoomRange.maxZoom,
      } as const;
      const service = getService();
      const summary = await service.startSession(nodeId, points, settings, {
        concurrency,
      });
      notify.success(
        translations.build?.success?.replace?.('{sessionId}', summary.sessionId) ??
          `Build started (session ${summary.sessionId})`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(
        translations.build?.error?.replace?.('{message}', message) ??
          `Build failed: ${message}`
      );
    } finally {
      setIsBuilding(false);
    }
  }, [concurrency, nodeId, translations, zoomRange.maxZoom, zoomRange.minZoom]);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {!canBuild && (
        <Alert severity="info">
          {translations.build?.requiresApproval ??
            'Provide a data source, accept license terms, and save the node before building.'}
        </Alert>
      )}
      <Box>
        <Typography variant="h6" gutterBottom>
          {translations.basicInfo?.title ?? 'Build vector tiles'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {translations.basicInfo?.descriptionHelperText ??
            'Prepare the selected locations and start the batch pipeline to generate the basemap layers.'}
        </Typography>
      </Box>
      <Box display="flex" gap={2} flexWrap="wrap">
        <Button
          variant="contained"
          color="primary"
          onClick={handleBuild}
          disabled={!canBuild || isBuilding}
        >
          {isBuilding ? (translations.build?.inProgress ?? 'Building…') : (translations.build?.actionLabel ?? 'Build')}
        </Button>
      </Box>
    </Box>
  );
};
