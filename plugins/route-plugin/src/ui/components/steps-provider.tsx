import { notify } from '@hierarchidb/components';
import { type NodeId, toNodeId } from '@hierarchidb/core-types';
import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
  type StartBuildContext,
} from '@hierarchidb/plugin-base';
import type { RouteEntity } from '@hierarchidb/route-api';
import { i18n } from '@hierarchidb/ui-i18n';
import { RouteBuildStep } from './steps/RouteBuildStep/RouteBuildStep.js';
import { RouteDataSourceStep } from './steps/RouteDataSourceStep.js';
import { RoutePreviewStep } from './steps/RoutePreviewStep.js';
import { RouteProcessingStep } from './steps/RouteProcessingStep.js';
import { RouteSelectionStep } from './steps/RouteSelectionStep.js';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = Partial<RouteEntity>;

type StepProps = PluginStepProps<RouteStepData>;

const resolveNodeId = (nodeId?: string): NodeId | undefined =>
  typeof nodeId === 'string' && nodeId.length > 0 ? toNodeId(nodeId) : undefined;

const mergeDraft = (current: RouteStepData, updates: Partial<RouteStepData>): RouteStepData => {
  return {
    ...(current ?? {}),
    ...(updates ?? {}),
  };
};

const normalizeComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparableValue(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.keys(record)
      .sort()
      .forEach((key) => {
        next[key] = normalizeComparableValue(record[key]);
      });
    return next;
  }
  return value;
};

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(normalizeComparableValue(value));
  } catch {
    return '';
  }
};

const createDraftUpdater = (
  initial: RouteStepData,
  onChange: (next: RouteStepData) => void
): ((updates: Partial<RouteEntity>) => void) => {
  let latestDraft = { ...(initial ?? {}) };
  let latestSignature = serializeComparable(latestDraft);
  return (updates) => {
    const nextDraft = mergeDraft(latestDraft, updates);
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(latestDraft);
  };
};

const hasAnyRouteSelection = (selection?: Record<string, boolean[]>): boolean =>
  Boolean(selection && Object.values(selection).some((row) => row?.some(Boolean)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCoordinatePair = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate));

const hasDirectRouteFields = (data?: RouteStepData): boolean =>
  Boolean(
    data?.routeMode &&
      data.startLocationId &&
      data.endLocationId &&
      Array.isArray(data.lineGeometry) &&
      data.lineGeometry.length >= 2
  );

const hasSelectionDrivenFields = (data?: RouteStepData): boolean =>
  Boolean(data?.tabularSourceId || data?.selectedArrayByCountries);

const hasSelectionDrivenRouteBuildInput = (routeBuildInput: unknown): boolean => {
  if (!isRecord(routeBuildInput) || routeBuildInput.kind !== 'selection-driven') return false;
  const routes = routeBuildInput.routes;
  return (
    Array.isArray(routes) &&
    routes.length > 0 &&
    routes.every((route) => {
      if (!isRecord(route)) return false;
      return (
        typeof route.startLocationId === 'string' &&
        route.startLocationId.length > 0 &&
        typeof route.endLocationId === 'string' &&
        route.endLocationId.length > 0 &&
        typeof route.routeMode === 'string' &&
        route.routeMode.length > 0 &&
        isCoordinatePair(route.startCoordinates) &&
        isCoordinatePair(route.endCoordinates)
      );
    })
  );
};

const hasCanonicalRouteBuildInput = (data?: RouteStepData): boolean => {
  if (!data?.buildConfig) return false;
  const routeBuildInput = (data as Record<string, unknown>).routeBuildInput;
  if (!isRecord(routeBuildInput)) return false;
  if (routeBuildInput.kind === 'selection-driven') {
    return !hasDirectRouteFields(data) && hasSelectionDrivenRouteBuildInput(routeBuildInput);
  }
  if (routeBuildInput.kind === 'direct-route') {
    return !hasSelectionDrivenFields(data) && hasDirectRouteFields(data);
  }
  return false;
};

const hasRouteDataSourceReady = (data?: Partial<RouteEntity>): boolean => {
  if (!data?.dataSourceName) {
    return false;
  }
  if (data.dataSourceName === 'ide-gsm') {
    return Boolean(data.tabularSourceId);
  }
  return true;
};

const hasRouteConfig = (data?: RouteStepData): boolean => {
  return Boolean(
    (hasRouteDataSourceReady(data) && hasAnyRouteSelection(data?.selectedArrayByCountries)) ||
      hasCanonicalRouteBuildInput(data)
  );
};

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  data?.processingStatus === 'completed';

const startRouteBuild = async (data: RouteStepData, _context: StartBuildContext) => {
  const t = (key: string, fallback: string) =>
    String(i18n.t(key, { ns: 'route-plugin', defaultValue: fallback }));
  const hasEssentials = Boolean(
    (hasRouteDataSourceReady(data) && hasAnyRouteSelection(data?.selectedArrayByCountries)) ||
      hasCanonicalRouteBuildInput(data)
  );

  if (!hasEssentials) {
    notify.info(
      t(
        'messages.completeBeforeBuild',
        'Complete the required route settings before starting a stage.'
      )
    );
    return;
  }

  notify.info(
    t('messages.batchNotImplemented', 'Route build launch is not yet implemented in this dialog.')
  );
};

registry.registerConfigProvider<RouteStepData>({
  nodeType: 'route',
  getCreateStepConfigs(): PluginStepConfig<RouteStepData>[] {
    const t = (key: string, fallback: string) =>
      String(i18n.t(key, { ns: 'route-plugin', defaultValue: fallback }));
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RouteDataSourceStep
              draft={draft}
              onUpdate={handleUpdate}
              onValidationChange={p.setValid}
              nodeId={resolveNodeId(p.nodeId)}
            />
          );
        },
        validate: (data?: RouteStepData) => hasRouteDataSourceReady(data),
      },
      {
        id: 'route-config',
        label: t('steps.routeConfig.label', 'Route Selection'),
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RouteSelectionStep
              draft={draft}
              onUpdate={handleUpdate}
              onValidationChange={p.setValid}
              mode={p.mode}
              nodeId={resolveNodeId(p.nodeId)}
              parentId={resolveNodeId(p.parentId)}
            />
          );
        },
        validate: hasRouteConfig,
      },
      {
        id: 'processing',
        label: t('steps.processing.label', 'Config'),
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RouteProcessingStep
              draft={draft}
              onUpdate={handleUpdate}
              nodeId={resolveNodeId(p.nodeId)}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t('steps.stage.label', 'Build'),
        optional: false,
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RouteBuildStep
              draft={draft}
              onUpdate={handleUpdate}
              nodeId={resolveNodeId(p.nodeId)}
              parentId={resolveNodeId(p.parentId)}
              mode={p.mode}
            />
          );
        },
        capabilities: {
          canStartBuild: (data: RouteStepData) => {
            return hasRouteConfig(data);
          },
          startBuild: (data, context) => startRouteBuild(data as RouteStepData, context),
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RoutePreviewStep
              draft={draft}
              nodeId={resolveNodeId(p.nodeId)}
              onUpdate={handleUpdate}
            />
          );
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
