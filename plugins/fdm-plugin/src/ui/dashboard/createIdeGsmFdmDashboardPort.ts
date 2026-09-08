import {
  FdmContractError,
  type FdmDashboardActionInput,
  type FdmDashboardCellDetail,
  type FdmDashboardCellDetailQuery,
  type FdmDashboardCellLogEvent,
  type FdmDashboardCellLogSubscriptionInput,
  type FdmDashboardDimensions,
  type FdmDashboardPort,
  type FdmDashboardQuery,
  type FdmDashboardResponse,
  type FdmDashboardRuntimeEventSubscriptionInput,
  type FdmDimensionValue,
  type FdmNodeData,
  type FdmRuntimeEvent,
  normalizeFdmDashboardResponse,
  type FdmDashboardCell as PortDashboardCell,
} from '@hierarchidb/fdm-api';
import type {
  FdmCellDetailInput,
  FdmCellDetailPayload,
  FdmCellLogInput,
  FdmCellLogListener,
  FdmCellLogStreamPayload,
  FdmDashboardStatusInput,
  FdmDashboardStatusPayload,
  FdmRuntimeEventListener,
  FdmRuntimeEventPayload,
  FdmRuntimeEventsInput,
  FdmVerifyInput,
  FdmVerifyReport,
  FdmDashboardCell as IdeGsmDashboardCell,
} from '@hierarchidb/ide-gsm-client';

export interface IdeGsmFdmDashboardClient {
  readonly fdmDashboardStatus: (
    input: FdmDashboardStatusInput
  ) => Promise<FdmDashboardStatusPayload>;
  readonly fdmCellDetail: (input: FdmCellDetailInput) => Promise<FdmCellDetailPayload>;
  readonly subscribeFdmCellLog: (input: FdmCellLogInput, onLog: FdmCellLogListener) => () => void;
  readonly subscribeFdmRuntimeEvents?: (
    input: FdmRuntimeEventsInput,
    onEvent: FdmRuntimeEventListener
  ) => () => void;
  readonly fdmSweep: (input: FdmVerifyInput) => Promise<FdmVerifyReport>;
}

export interface IdeGsmFdmDashboardPortOptions {
  readonly resolveProjectRelativePath?: (
    node: FdmNodeData
  ) => string | undefined | Promise<string | undefined>;
}

export function createIdeGsmFdmDashboardPort(
  client: IdeGsmFdmDashboardClient,
  options: IdeGsmFdmDashboardPortOptions = {}
): FdmDashboardPort {
  const resolveProjectRelativePath = options.resolveProjectRelativePath;
  const subscribeFdmRuntimeEvents = client.subscribeFdmRuntimeEvents;
  const loadDashboard = async (query: FdmDashboardQuery): Promise<FdmDashboardResponse> => {
    const status = await client.fdmDashboardStatus(toStatusInput(query));
    return toDashboardResponse(query, status);
  };

  return {
    loadDashboard,
    loadCellDetail: async (query: FdmDashboardCellDetailQuery): Promise<FdmDashboardCellDetail> => {
      const detail = await client.fdmCellDetail(toCellInput(query));
      return toCellDetail(query.cell, detail);
    },
    subscribeCellLog: (input: FdmDashboardCellLogSubscriptionInput, onLog): (() => void) =>
      client.subscribeFdmCellLog(toCellLogInput(input), (event) => {
        onLog(toCellLogEvent(input.cell, event));
      }),
    subscribeRuntimeEvents:
      resolveProjectRelativePath && subscribeFdmRuntimeEvents
        ? async (
            input: FdmDashboardRuntimeEventSubscriptionInput,
            onEvent
          ): Promise<() => void> => {
            const projectRelativePath = await resolveProjectRelativePath(input.node);
            if (projectRelativePath === undefined) {
              throw new FdmContractError('FDM_RUNTIME_EVENTS_PROJECT_PATH_UNAVAILABLE');
            }
            assertRuntimeProjectRelativePath(projectRelativePath);
            return subscribeFdmRuntimeEvents(
              toRuntimeEventsInput(input, projectRelativePath),
              (event) => {
                onEvent(toRuntimeEvent(event));
              }
            );
          }
        : undefined,
    performAction: async (input: FdmDashboardActionInput): Promise<FdmDashboardResponse> => {
      if (input.action === 'run-selected') {
        const current = await loadDashboard({
          node: input.node,
          filters: input.filters,
          axisMap: input.axisMap,
          selectedStateDir: input.selectedStateDir,
          signal: input.signal,
        });
        const selectedCell = selectedActionCell(current.cells, input.selectedCellId);
        await client.fdmSweep(toSweepInput(current, selectedCell));
      }
      return loadDashboard({
        node: input.node,
        filters: input.filters,
        axisMap: input.axisMap,
        selectedStateDir: input.selectedStateDir,
        signal: input.signal,
      });
    },
  };
}

function assertRuntimeProjectRelativePath(projectRelativePath: string): void {
  const segments = projectRelativePath.split(/[\\/]/u);
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(projectRelativePath);
  if (
    projectRelativePath.length === 0 ||
    projectRelativePath.trim() !== projectRelativePath ||
    projectRelativePath.startsWith('/') ||
    projectRelativePath.startsWith('\\') ||
    isWindowsAbsolute ||
    segments.includes('..')
  ) {
    throw new FdmContractError('FDM_RUNTIME_EVENTS_PROJECT_PATH_INVALID');
  }
}

function toRuntimeEventsInput(
  input: FdmDashboardRuntimeEventSubscriptionInput,
  projectRelativePath: string
): FdmRuntimeEventsInput {
  return {
    projectRelativePath,
    stateDir: input.selectedStateDir,
  };
}

function toRuntimeEvent(payload: FdmRuntimeEventPayload): FdmRuntimeEvent {
  return {
    id: [
      'fdm-runtime',
      payload.taskId ?? 'no-task',
      payload.receivedAt ?? 'no-time',
      payload.phase ?? 'no-phase',
    ].join(':'),
    status: toRuntimeCellStatus(payload),
    message: payload.message ?? payload.phase ?? 'Runtime event',
    occurredAt: payload.receivedAt ?? new Date(0).toISOString(),
  };
}

function toRuntimeCellStatus(payload: FdmRuntimeEventPayload): FdmRuntimeEvent['status'] {
  switch (payload.phase) {
    case 'ACCEPTED':
    case 'STARTED':
    case 'PROGRESS':
      return 'running';
    case 'SUCCEEDED':
      return 'succeeded';
    case 'FAILED':
      return 'failed';
    case 'CANCELED':
      return 'blocked';
    default:
      return 'idle';
  }
}

function toCellInput(query: FdmDashboardCellDetailQuery): FdmCellDetailInput {
  return {
    spaceId: query.node.spaceId,
    parameterSet: query.cell.parameterSet,
    dataset: query.cell.dataset,
    compute: query.cell.compute,
    timelinePoint: query.cell.timeline,
    stateDir: query.selectedStateDir,
  };
}

function toCellLogInput(input: FdmDashboardCellLogSubscriptionInput): FdmCellLogInput {
  return {
    spaceId: input.node.spaceId,
    parameterSet: input.cell.parameterSet,
    dataset: input.cell.dataset,
    compute: input.cell.compute,
    timelinePoint: input.cell.timeline,
    stateDir: input.selectedStateDir,
  };
}

function toCellDetail(
  cell: PortDashboardCell,
  payload: FdmCellDetailPayload
): FdmDashboardCellDetail {
  return {
    cell,
    generatedAt: payload.generatedAt ?? undefined,
    selectedStateDir: payload.selectedStateDir ?? undefined,
    startedAt: payload.startedAt ?? undefined,
    updatedAt: payload.updatedAt ?? undefined,
    finishedAt: payload.finishedAt ?? undefined,
    elapsedMs: payload.elapsedMs ?? undefined,
    estimatedRemainingMs: payload.estimatedRemainingMs ?? undefined,
    estimatedCompletedAt: payload.estimatedCompletedAt ?? undefined,
    logPath: payload.logPath ?? undefined,
    latestLogLines: payload.latestLogLines ?? [],
  };
}

function toCellLogEvent(
  cell: PortDashboardCell,
  payload: FdmCellLogStreamPayload
): FdmDashboardCellLogEvent {
  return {
    cell,
    generatedAt: payload.generatedAt ?? undefined,
    logPath: payload.logPath ?? undefined,
    latestLogLines: payload.latestLogLines ?? [],
  };
}

function selectedActionCell(
  cells: readonly PortDashboardCell[],
  selectedCellId: string | undefined
): PortDashboardCell {
  if (selectedCellId === undefined) {
    throw new FdmContractError('FDM_RUN_SELECTED_REQUIRES_SELECTED_CELL');
  }
  const selectedCell = cells.find((cell) => cell.id === selectedCellId);
  if (selectedCell === undefined) {
    throw new FdmContractError('FDM_RUN_SELECTED_CELL_NOT_FOUND');
  }
  return selectedCell;
}

function toSweepInput(
  dashboard: FdmDashboardResponse,
  selectedCell: PortDashboardCell
): FdmVerifyInput {
  const input: FdmVerifyInput = {
    spaceId: dashboard.node.spaceId,
    parameterSet: [selectedCell.parameterSet],
    dataset: [selectedCell.dataset],
    computeEngine: [selectedCell.compute],
    timeline: [selectedCell.timeline],
  };
  if (dashboard.selectedStateDir !== undefined) {
    input.stateDir = dashboard.selectedStateDir;
  }
  return input;
}

function toStatusInput(query: FdmDashboardQuery): FdmDashboardStatusInput {
  return {
    spaceId: query.node.spaceId,
    parameterSet: first(query.filters.parameterSets),
    dataset: first(query.filters.datasets),
    compute: first(query.filters.computes),
    timeline: first(query.filters.timelines),
    stateDir: query.selectedStateDir,
  };
}

function toDashboardResponse(
  query: FdmDashboardQuery,
  payload: FdmDashboardStatusPayload
): FdmDashboardResponse {
  const sourceCells = payload.cells ?? [];
  const dimensions = toDimensions(payload, sourceCells);
  const cells = sourceCells.map((cell) => toDashboardCell(cell));
  const response: FdmDashboardResponse = {
    node: {
      ...query.node,
      selectedStateDir: payload.selectedStateDir ?? query.selectedStateDir,
    },
    connectionState: 'connected',
    spaceLabel: payload.selectedSpaceId ?? query.node.spaceId,
    stateDirectories: payload.availableStateDirs ?? [],
    selectedStateDir: payload.selectedStateDir ?? query.selectedStateDir,
    dimensions,
    cells,
    runtimeEvents: toRuntimeEvents(payload, cells),
    logs: [],
    directoryEntries: [],
    resultLocations: [],
    refreshedAt: payload.generatedAt ?? new Date(0).toISOString(),
  };
  return normalizeFdmDashboardResponse(response).response;
}

function toDimensions(
  payload: FdmDashboardStatusPayload,
  cells: readonly IdeGsmDashboardCell[]
): FdmDashboardDimensions {
  const parameterSetIds = mergeIds(
    payload.parameterSet,
    cells.map((cell) => cell.parameterSet)
  );
  const profileIds = mergeIds(
    payload.profile,
    cells.map((cell) => cell.profile)
  );
  const timelineIds = mergeIds(
    payload.timeline,
    cells.map((cell) => cell.timelinePoint)
  );
  const checkpointIds = mergeIds(
    undefined,
    cells.map((cell) => cell.checkpoint)
  );
  return {
    parameterSets: toDimensionValues(parameterSetIds),
    profiles: toDimensionValues(profileIds.length > 0 ? profileIds : parameterSetIds),
    datasets: toDimensionValues(
      mergeIds(
        payload.dataset,
        cells.map((cell) => cell.dataset)
      )
    ),
    computes: toDimensionValues(
      mergeIds(
        payload.compute,
        cells.map((cell) => cell.compute)
      )
    ),
    timelines: toDimensionValues(timelineIds.length > 0 ? timelineIds : checkpointIds),
    checkpoints: toDimensionValues(checkpointIds.length > 0 ? checkpointIds : timelineIds),
  };
}

function toDashboardCell(cell: IdeGsmDashboardCell): PortDashboardCell {
  const parameterSet = requireCellValue(cell.parameterSet ?? cell.profile, 'parameterSet');
  const dataset = requireCellValue(cell.dataset, 'dataset');
  const compute = requireCellValue(cell.compute, 'compute');
  const timeline = requireCellValue(cell.timelinePoint ?? cell.checkpoint, 'timeline');
  return {
    id: [parameterSet, dataset, compute, timeline].join('::'),
    parameterSet,
    profile: cell.profile ?? parameterSet,
    dataset,
    compute,
    timeline,
    checkpoint: cell.checkpoint ?? timeline,
    status: toCellStatus(cell),
    message: cell.rawStatus ?? cell.label ?? undefined,
    resultRef: cell.summaryFile ?? undefined,
    snapshot: {
      timelineId: timeline,
      checkpoint: cell.checkpoint ?? undefined,
      resultRef: cell.summaryFile ?? undefined,
    },
  };
}

function toRuntimeEvents(
  payload: FdmDashboardStatusPayload,
  cells: readonly PortDashboardCell[]
): readonly FdmRuntimeEvent[] {
  const liveStatus = payload.live?.status;
  if (!liveStatus) return [];
  return [
    {
      id: `fdm-live-${payload.generatedAt ?? 'unknown'}`,
      cellId: cells.find((cell) => cell.status === 'running')?.id,
      status: liveStatus.toLowerCase().includes('fail') ? 'failed' : 'running',
      message: liveStatus,
      occurredAt: payload.live?.startedAt ?? payload.generatedAt ?? new Date(0).toISOString(),
    },
  ];
}

function toCellStatus(cell: IdeGsmDashboardCell): PortDashboardCell['status'] {
  const raw = (cell.rawStatus ?? cell.bucket ?? '').toLowerCase();
  if (cell.blockingDrift || raw.includes('block')) return 'blocked';
  if (raw.includes('fail') || raw.includes('error')) return 'failed';
  if (raw.includes('success') || raw.includes('succeed') || raw.includes('complete')) {
    return 'succeeded';
  }
  if (cell.current || raw.includes('running') || raw.includes('progress')) return 'running';
  if (cell.next || raw.includes('queued') || raw.includes('pending')) return 'queued';
  return 'idle';
}

function toDimensionValues(ids: readonly string[]): readonly FdmDimensionValue[] {
  return ids.map((id) => ({ id, label: id }));
}

function mergeIds(
  primary: readonly (string | null)[] | null | undefined,
  secondary: readonly (string | null)[]
): readonly string[] {
  const ids = new Set<string>();
  for (const value of [...(primary ?? []), ...secondary]) {
    if (typeof value === 'string' && value.length > 0) {
      ids.add(value);
    }
  }
  return [...ids];
}

function first(values: readonly string[]): string | undefined {
  return values.length > 0 ? values[0] : undefined;
}

function requireCellValue(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FdmContractError(`FDM dashboard cell is missing ${label}`);
  }
  return value;
}
