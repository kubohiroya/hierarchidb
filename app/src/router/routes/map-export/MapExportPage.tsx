import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { LocationType } from '@hierarchidb/location-store';
import {
  MAP_EXPORT_SCREENSHOT_SELECTOR,
  MAP_EXPORT_SCREENSHOT_TARGET_ATTRIBUTE,
  type MapExportBrowserApi,
  type MapExportBrowserCommittedNode,
  type MapExportBrowserErrorCode,
  type MapExportBrowserErrorSignal,
  type MapExportBrowserJob,
  type MapExportBrowserState,
  type MapExportBrowserStatus,
  type MapExportBrowserSubmitResult,
  type MapExportNodePayload,
} from '@hierarchidb/map-export';
import type {
  LayerSetVisibility,
  MapLibreMapInstance,
  MapViewState,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { buildCategoryFilter, ResourceLayerMap } from '@hierarchidb/ui-plugin-shell/ui-map';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { Box } from '@mui/material';
import type { Remote } from 'comlink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LOCATION_TYPE_COLORS, LOCATION_TYPE_OPTIONS } from '../map/constants.js';
import { useFolderLayers } from '../map/useFolderLayers.js';
import { useLocationViewportLayers } from '../map/useLocationViewportLayers.js';

declare global {
  interface Window {
    __HDB_MAP_EXPORT__?: MapExportBrowserApi;
  }
}

const BUILD_STATUS_POLL_INTERVAL_MS = 1_000;
const BUILD_STATUS_TIMEOUT_MS = 300_000;
const MAP_RENDER_TIMEOUT_MS = 60_000;
const MAP_RENDER_BBOX_PADDING_PX = 0;
const LOCATION_MAX_ZOOM = 11;
const CIRCLE_RADIUS_MIN = 2;
const CIRCLE_RADIUS_SLOPE = 0.6;
const CIRCLE_RADIUS_AT_MAX = CIRCLE_RADIUS_MIN + LOCATION_MAX_ZOOM * CIRCLE_RADIUS_SLOPE;
const ICON_SIZE_MIN = 0.7;
const ICON_SIZE_SLOPE = 0.05;
const ICON_SIZE_AT_MAX = ICON_SIZE_MIN + LOCATION_MAX_ZOOM * ICON_SIZE_SLOPE;

type MapRenderRequest = {
  job: MapExportBrowserJob;
  nodes: MapExportBrowserCommittedNode[];
};

type PendingMapRender = {
  jobId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const createState = (
  status: MapExportBrowserStatus,
  updates: Omit<MapExportBrowserState, 'status' | 'selector'> = {}
): MapExportBrowserState => ({
  status,
  selector: MAP_EXPORT_SCREENSHOT_SELECTOR,
  ...updates,
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const createErrorSignal = (
  code: MapExportBrowserErrorCode,
  message: string,
  cause?: unknown
): MapExportBrowserErrorSignal => {
  const signal: MapExportBrowserErrorSignal = { code, message };
  if (cause instanceof Error) {
    signal.cause = cause.message;
  } else if (typeof cause === 'string' && cause.length > 0) {
    signal.cause = cause;
  }
  return signal;
};

const assertMapExportJob = (job: MapExportBrowserJob): void => {
  if (!job || typeof job !== 'object') {
    throw new Error('job must be an object');
  }
  if (typeof job.id !== 'string' || job.id.trim().length === 0) {
    throw new Error('job.id must be a non-empty string');
  }
  if (!isFiniteNumber(job.viewport.width) || !isFiniteNumber(job.viewport.height)) {
    throw new Error('job.viewport width and height must be finite numbers');
  }
  if (job.viewport.width <= 0 || job.viewport.height <= 0) {
    throw new Error('job.viewport width and height must be positive');
  }
  if (job.bbox.length !== 4 || !job.bbox.every(isFiniteNumber)) {
    throw new Error('job.bbox must contain four finite numbers');
  }
  const [west, south, east, north] = job.bbox;
  if (west < -180 || west > 180 || east < -180 || east > 180 || west >= east) {
    throw new Error('job.bbox longitude bounds must satisfy -180 <= west < east <= 180');
  }
  if (south < -90 || south > 90 || north < -90 || north > 90 || south >= north) {
    throw new Error('job.bbox latitude bounds must satisfy -90 <= south < north <= 90');
  }
  if (!Array.isArray(job.nodes) || job.nodes.length === 0) {
    throw new Error('job.nodes must contain at least one node');
  }
  const manifestNodeIds = new Set<string>();
  for (const node of job.nodes) {
    if (typeof node.nodeId !== 'string') continue;
    if (manifestNodeIds.has(node.nodeId)) {
      throw new Error(`duplicate manifest nodeId: ${node.nodeId}`);
    }
    manifestNodeIds.add(node.nodeId);
  }
  for (const layer of job.layers) {
    if (!manifestNodeIds.has(layer.nodeId)) {
      throw new Error(`layer references unknown manifest nodeId: ${layer.nodeId}`);
    }
  }
  if (
    !job.target ||
    typeof job.target !== 'object' ||
    typeof job.target.treeId !== 'string' ||
    job.target.treeId.trim().length === 0 ||
    typeof job.target.parentId !== 'string' ||
    job.target.parentId.trim().length === 0
  ) {
    throw new Error('job.target treeId and parentId must be non-empty strings');
  }
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createNodeName = (job: MapExportBrowserJob, node: MapExportNodePayload, index: number) => {
  const suffix = node.nodeId ?? `node-${index + 1}`;
  return `map-export-${job.id}-${suffix}`;
};

const commitManifestNodes = async (
  workerApi: Remote<WorkerAPI<unknown>>,
  job: MapExportBrowserJob
): Promise<MapExportBrowserCommittedNode[]> => {
  const mutationApi = await workerApi.getMutationAPI();
  const updaterApi = await workerApi.getTreeNodeUpdaterAPI();
  const committedNodes: MapExportBrowserCommittedNode[] = [];

  for (const [index, node] of job.nodes.entries()) {
    const name = createNodeName(job, node, index);
    const created = await mutationApi.createNode({
      nodeType: node.nodeType as NodeType,
      treeId: job.target.treeId as TreeId,
      parentId: job.target.parentId as NodeId,
      name,
      isTemporary: true,
    });
    if (!created.success) {
      throw new Error(created.error);
    }

    const metadata = {
      name,
      description: '',
      tags: [],
    };
    const committed = await updaterApi.updateTreeNode(created.nodeId, {
      data: node.data,
      draftData: node.data,
      metadata,
      draftMetadata: metadata,
      mode: 'save',
      onNameConflict: 'error',
    });
    if (committed.status !== 'ok') {
      throw new Error(`commit failed with status ${committed.status}`);
    }
    committedNodes.push({
      manifestNodeId: node.nodeId,
      nodeId: committed.nodeId,
      nodeType: node.nodeType,
    });
  }

  return committedNodes;
};

const waitForBuildCompletion = async (
  workerApi: Remote<WorkerAPI<unknown>>,
  node: MapExportBrowserCommittedNode
): Promise<void> => {
  const deadline = Date.now() + BUILD_STATUS_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const status = await workerApi.getBuildSessionStatus(
      node.nodeType as NodeType,
      node.nodeId as NodeId
    );
    if (status.status === 'completed') return;
    if (status.status === 'failed') {
      throw new Error(status.error ?? `build failed for node ${node.nodeId}`);
    }
    await wait(BUILD_STATUS_POLL_INTERVAL_MS);
  }
  throw new Error(`build timed out for node ${node.nodeId}`);
};

const startAndWaitForBuilds = async (
  workerApi: Remote<WorkerAPI<unknown>>,
  nodes: MapExportBrowserCommittedNode[]
): Promise<void> => {
  for (const node of nodes) {
    const started = await workerApi.startBuildSession(
      node.nodeType as NodeType,
      node.nodeId as NodeId,
      'committed'
    );
    if (started.status === 'failed') {
      throw new Error(started.error ?? `build failed for node ${node.nodeId}`);
    }
    await waitForBuildCompletion(workerApi, node);
  }
};

const createInitialViewState = (job?: MapExportBrowserJob): MapViewState => {
  if (!job) return { longitude: 0, latitude: 0, zoom: 2 };
  const [west, south, east, north] = job.bbox;
  return {
    longitude: (west + east) / 2,
    latitude: (south + north) / 2,
    zoom: 2,
  };
};

const getVisibleCommittedNodeIds = (
  job: MapExportBrowserJob,
  nodes: MapExportBrowserCommittedNode[]
): Set<string> => {
  if (job.layers.length === 0) {
    return new Set(nodes.map((node) => node.nodeId));
  }
  const committedByManifestId = new Map(
    nodes
      .filter((node): node is MapExportBrowserCommittedNode & { manifestNodeId: string } =>
        Boolean(node.manifestNodeId)
      )
      .map((node) => [node.manifestNodeId, node.nodeId])
  );
  return new Set(
    job.layers
      .filter((layer) => layer.visible)
      .map((layer) => committedByManifestId.get(layer.nodeId))
      .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0)
  );
};

const getVectorLayerId = (layer: ResourceVectorLayer): string =>
  layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;

const getLocationLayerIds = (layer: { layerId: string }): string[] => [
  `${layer.layerId}-circle`,
  `${layer.layerId}-icon`,
];

const areExpectedLayersAttached = (
  map: MapLibreMapInstance,
  layerIds: readonly string[]
): boolean => layerIds.every((layerId) => Boolean(map.getLayer(layerId)));

const isCanvasNonBlank = (map: MapLibreMapInstance): boolean => {
  const canvas = map.getCanvas();
  const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!context) return false;
  const width = context.drawingBufferWidth;
  const height = context.drawingBufferHeight;
  if (width <= 0 || height <= 0) return false;
  const pixels = new Uint8Array(width * height * 4);
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      pixels[index] !== 0 ||
      pixels[index + 1] !== 0 ||
      pixels[index + 2] !== 0 ||
      pixels[index + 3] !== 0
    ) {
      return true;
    }
  }
  return false;
};

export default function MapExportPage() {
  const [state, setState] = useState<MapExportBrowserState>(() => createState('idle'));
  const [renderRequest, setRenderRequest] = useState<MapRenderRequest | null>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const stateRef = useRef(state);
  const pendingMapRenderRef = useRef<PendingMapRender | null>(null);

  const publishState = useCallback((next: MapExportBrowserState): MapExportBrowserState => {
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const waitForMapRender = useCallback(
    (job: MapExportBrowserJob, nodes: MapExportBrowserCommittedNode[]): Promise<void> =>
      new Promise((resolve, reject) => {
        const existing = pendingMapRenderRef.current;
        if (existing) {
          clearTimeout(existing.timeoutId);
          existing.reject(new Error(`map render superseded for job ${existing.jobId}`));
        }
        const timeoutId = setTimeout(() => {
          if (pendingMapRenderRef.current?.jobId === job.id) {
            pendingMapRenderRef.current = null;
          }
          reject(new Error(`map render timed out for job ${job.id}`));
        }, MAP_RENDER_TIMEOUT_MS);
        pendingMapRenderRef.current = { jobId: job.id, resolve, reject, timeoutId };
        setMapInstance(null);
        setRenderRequest({ job, nodes });
      }),
    []
  );

  const submitJob = useCallback(
    async (job: MapExportBrowserJob): Promise<MapExportBrowserSubmitResult> => {
      if (stateRef.current.status === 'initializing') {
        return createState('failed', {
          jobId: typeof job?.id === 'string' ? job.id : undefined,
          error: createErrorSignal(
            'job_already_running',
            'Map export page accepts one active job at a time.'
          ),
        });
      }

      try {
        assertMapExportJob(job);
      } catch (error) {
        return publishState(
          createState('failed', {
            jobId: typeof job?.id === 'string' ? job.id : undefined,
            error: createErrorSignal('invalid_job', 'Map export job contract violation.', error),
          })
        );
      }

      publishState(createState('initializing', { jobId: job.id }));

      let workerApi: Remote<WorkerAPI<unknown>>;
      try {
        workerApi = await ensureWorkerAPI();
      } catch (error) {
        return publishState(
          createState('failed', {
            jobId: job.id,
            error: createErrorSignal(
              'runtime_worker_unavailable',
              'Runtime worker initialization failed before export build start.',
              error
            ),
          })
        );
      }

      let committedNodes: MapExportBrowserCommittedNode[];
      try {
        committedNodes = await commitManifestNodes(workerApi, job);
      } catch (error) {
        return publishState(
          createState('failed', {
            jobId: job.id,
            error: createErrorSignal(
              'node_commit_failed',
              'Map export node creation or committed data save failed.',
              error
            ),
          })
        );
      }

      try {
        await startAndWaitForBuilds(workerApi, committedNodes);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return publishState(
          createState('failed', {
            jobId: job.id,
            nodes: committedNodes,
            error: createErrorSignal(
              message.includes('timed out') ? 'build_timeout' : 'build_failed',
              'Map export canonical build failed.',
              error
            ),
          })
        );
      }

      try {
        await waitForMapRender(job, committedNodes);
      } catch (error) {
        return publishState(
          createState('failed', {
            jobId: job.id,
            nodes: committedNodes,
            error: createErrorSignal(
              'maplibre_not_ready',
              'MapLibre export rendering failed.',
              error
            ),
          })
        );
      }

      return publishState(createState('ready', { jobId: job.id, nodes: committedNodes }));
    },
    [publishState, waitForMapRender]
  );

  const handlePersistedZxy = useCallback(() => {
    return;
  }, []);

  const { vectorLayers, geoJsonLayers, locationLayers, basemapStyles, styleOverridesByType } =
    useFolderLayers({
      nodeId: renderRequest?.job.target.parentId,
      onPersistedZxy: handlePersistedZxy,
    });

  const visibleCommittedNodeIds = useMemo(() => {
    if (!renderRequest) return new Set<string>();
    return getVisibleCommittedNodeIds(renderRequest.job, renderRequest.nodes);
  }, [renderRequest]);

  const visibleVectorLayers = useMemo(
    () => vectorLayers.filter((layer) => visibleCommittedNodeIds.has(layer.nodeId)),
    [vectorLayers, visibleCommittedNodeIds]
  );

  const visibleLocationLayers = useMemo(
    () => locationLayers.filter((layer) => visibleCommittedNodeIds.has(layer.nodeId)),
    [locationLayers, visibleCommittedNodeIds]
  );

  const renderedCommittedNodeIds = useMemo(
    () =>
      new Set([
        ...visibleVectorLayers.map((layer) => layer.nodeId),
        ...visibleLocationLayers.map((layer) => layer.nodeId),
      ]),
    [visibleLocationLayers, visibleVectorLayers]
  );

  const layerSetVisibility = useMemo<LayerSetVisibility>(
    () => ({ location: true, route: true, shape: true }),
    []
  );

  const enabledLocationKinds = useMemo(() => LOCATION_TYPE_OPTIONS.map((option) => option.id), []);

  const locationTypeFilter = useMemo(
    () => buildCategoryFilter(enabledLocationKinds, enabledLocationKinds, ['type']),
    [enabledLocationKinds]
  );

  const locationBaseColorExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'type']];
    Object.entries(LOCATION_TYPE_COLORS).forEach(([type, color]) => {
      expression.push(type, color);
    });
    expression.push(LOCATION_TYPE_COLORS.area_centroid);
    return expression;
  }, []);

  const locationCirclePaint = useMemo<Record<string, unknown>>(
    () => ({
      'circle-color': locationBaseColorExpression,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        CIRCLE_RADIUS_MIN,
        LOCATION_MAX_ZOOM,
        CIRCLE_RADIUS_AT_MAX,
      ],
      'circle-opacity': 0.8,
      'circle-blur': 0,
      'circle-stroke-color': locationBaseColorExpression,
      'circle-stroke-width': 0,
    }),
    [locationBaseColorExpression]
  );

  const locationIconImageExpression = useMemo(() => {
    const expression: Array<string | unknown> = ['match', ['get', 'type']];
    (Object.keys(LOCATION_TYPE_COLORS) as LocationType[]).forEach((type) => {
      expression.push(type, `location-icon-${type}`);
    });
    expression.push('location-icon-area_centroid');
    return expression;
  }, []);

  const locationIconSizeExpression = useMemo(
    () => [
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      ICON_SIZE_MIN,
      LOCATION_MAX_ZOOM,
      ICON_SIZE_AT_MAX,
    ],
    []
  );

  const {
    locationGeoJsonLayers,
    handleMapLoad: handleLocationMapLoad,
    handleLocationMoveEnd,
  } = useLocationViewportLayers({
    nodeId: renderRequest?.job.target.parentId,
    locationLayers: visibleLocationLayers,
    layerSetVisibility,
    enabledLocationKinds,
    locationTypeFilter,
    locationCirclePaint,
    locationIconImageExpression,
    locationIconSizeExpression,
    exportControlEnabled: false,
  });

  const visibleGeoJsonLayers = useMemo(
    () => [...geoJsonLayers, ...locationGeoJsonLayers],
    [geoJsonLayers, locationGeoJsonLayers]
  );

  const expectedLayerIds = useMemo(
    () => [
      ...visibleVectorLayers.map((layer) => getVectorLayerId(layer)),
      ...visibleLocationLayers.flatMap((layer) => getLocationLayerIds(layer)),
    ],
    [visibleLocationLayers, visibleVectorLayers]
  );

  const initialViewState = useMemo(
    () => createInitialViewState(renderRequest?.job),
    [renderRequest?.job]
  );

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      const job = renderRequest?.job;
      if (!job) return;
      const [west, south, east, north] = job.bbox;
      handleLocationMapLoad(map);
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: MAP_RENDER_BBOX_PADDING_PX }
      );
    },
    [handleLocationMapLoad, renderRequest]
  );

  useEffect(() => {
    if (!renderRequest || !mapInstance) return;
    const pending = pendingMapRenderRef.current;
    if (!pending || pending.jobId !== renderRequest.job.id) return;
    if (
      visibleCommittedNodeIds.size > 0 &&
      renderedCommittedNodeIds.size < visibleCommittedNodeIds.size
    ) {
      return;
    }

    const handleIdle = () => {
      const latestPending = pendingMapRenderRef.current;
      if (!latestPending || latestPending.jobId !== renderRequest.job.id) return;
      if (!areExpectedLayersAttached(mapInstance, expectedLayerIds)) return;
      try {
        if (!isCanvasNonBlank(mapInstance)) return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        latestPending.reject(new Error(`map canvas read failed: ${message}`));
        clearTimeout(latestPending.timeoutId);
        pendingMapRenderRef.current = null;
        return;
      }
      latestPending.resolve();
      clearTimeout(latestPending.timeoutId);
      pendingMapRenderRef.current = null;
    };

    mapInstance.on('idle', handleIdle);
    handleIdle();
    return () => {
      mapInstance.off('idle', handleIdle);
    };
  }, [
    expectedLayerIds,
    mapInstance,
    renderedCommittedNodeIds,
    renderRequest,
    visibleCommittedNodeIds,
  ]);

  useEffect(() => {
    const api: MapExportBrowserApi = {
      getState: () => stateRef.current,
      submitJob,
    };
    window.__HDB_MAP_EXPORT__ = api;
    return () => {
      if (window.__HDB_MAP_EXPORT__ === api) {
        window.__HDB_MAP_EXPORT__ = undefined;
      }
    };
  }, [submitJob]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        key={renderRequest?.job.id ?? 'idle'}
        data-map-export-page-state={state.status}
        data-map-export-job-id={state.jobId}
        data-map-export-error-code={state.error?.code}
        {...{ [MAP_EXPORT_SCREENSHOT_TARGET_ATTRIBUTE]: 'true' }}
        sx={{
          position: 'absolute',
          inset: 0,
          width: renderRequest ? renderRequest.job.viewport.width : '100%',
          height: renderRequest ? renderRequest.job.viewport.height : '100%',
        }}
      >
        {renderRequest ? (
          <ResourceLayerMap
            initialViewState={initialViewState}
            width="100%"
            height="100%"
            basemapStyles={basemapStyles}
            vectorLayers={visibleVectorLayers}
            geoJsonLayers={visibleGeoJsonLayers}
            styleOverridesByType={styleOverridesByType}
            onLoad={handleMapLoad}
            onMoveEnd={handleLocationMoveEnd}
            controls={{
              navigation: false,
              attribution: false,
              fullscreen: false,
              scale: false,
            }}
            mapOptions={{
              interactive: false,
              scrollZoom: false,
              dragPan: false,
              dragRotate: false,
              doubleClickZoom: false,
              touchZoomRotate: false,
              minZoom: 0,
              maxZoom: 22,
            }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
