import {
  type FdmAxisMap,
  type FdmDashboardActionInput,
  type FdmDashboardPort,
  type FdmDashboardQuery,
  type FdmDashboardResponse,
  type FdmFilters,
  type FdmNodeData,
  type FdmViewMode,
  normalizeFdmDashboardResponse,
} from '@hierarchidb/fdm-api';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { atom, type Getter } from 'jotai';
import { atomWithMutation, atomWithQuery, queryClientAtom } from 'jotai-tanstack-query';

export const fdmDashboardNodeAtom = atom<FdmNodeData | undefined>(undefined);
export const fdmDashboardPortAtom = atom<FdmDashboardPort | undefined>(undefined);
export const fdmDashboardDisabledAtom = atom(false);
export const fdmDashboardNodeChangeAtom = atom<((data: FdmNodeData) => void) | undefined>(
  undefined
);
export const fdmDashboardSelectedCellIdAtom = atom<string | undefined>(undefined);
export const fdmDashboardSelectedViewModeAtom = atom<FdmViewMode>('lattice-3d');
export const fdmDashboardFiltersAtom = atom<FdmFilters>({
  parameterSets: [],
  datasets: [],
  computes: [],
  timelines: [],
});
export const fdmDashboardAxisMapAtom = atom<FdmAxisMap>({
  xOuter: 'parameterSet',
  xInner: 'dataset',
  y: 'timeline',
  z: 'compute',
});

export function fdmDashboardQueryKey(input: {
  readonly node: FdmNodeData;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
}): QueryKey {
  return [
    'fdm-dashboard',
    input.node.connectionName,
    input.node.spaceId,
    input.node.selectedStateDir ?? '',
    input.filters,
    input.axisMap,
  ];
}

export const fdmDashboardQueryAtom = atomWithQuery((get: Getter) => {
  const node = get(fdmDashboardNodeAtom);
  const port = get(fdmDashboardPortAtom);
  const filters = get(fdmDashboardFiltersAtom);
  const axisMap = get(fdmDashboardAxisMapAtom);
  return {
    queryKey:
      node === undefined
        ? ['fdm-dashboard', 'missing-node']
        : fdmDashboardQueryKey({ node, filters, axisMap }),
    enabled: node !== undefined && port !== undefined,
    queryFn: async ({ signal }): Promise<FdmDashboardResponse> => {
      if (node === undefined || port === undefined) {
        throw new Error('FDM_DASHBOARD_PORT_NOT_READY');
      }
      const query: FdmDashboardQuery = {
        node,
        filters,
        axisMap,
        selectedStateDir: node.selectedStateDir,
        signal,
      };
      const next = await port.loadDashboard(query);
      return normalizeFdmDashboardResponse(next).response;
    },
  };
});

export const fdmDashboardActionAtom = atomWithMutation<
  FdmDashboardResponse,
  FdmDashboardActionInput['action'],
  Error
>((get: Getter) => {
  const node = get(fdmDashboardNodeAtom);
  const port = get(fdmDashboardPortAtom);
  const selectedCellId = get(fdmDashboardSelectedCellIdAtom);
  const disabled = get(fdmDashboardDisabledAtom);
  const filters = get(fdmDashboardFiltersAtom);
  const axisMap = get(fdmDashboardAxisMapAtom);
  const queryClient = get(queryClientAtom) as QueryClient;
  return {
    mutationKey: ['fdm-dashboard-action', node?.connectionName ?? '', node?.spaceId ?? ''],
    mutationFn: async (action): Promise<FdmDashboardResponse> => {
      if (disabled) {
        throw new Error('FDM_DASHBOARD_DISABLED');
      }
      if (node === undefined || port === undefined) {
        throw new Error('FDM_DASHBOARD_PORT_NOT_READY');
      }
      const controller = new AbortController();
      const next = await port.performAction({
        node,
        action,
        selectedCellId,
        signal: controller.signal,
      });
      return normalizeFdmDashboardResponse(next).response;
    },
    onSuccess: (next) => {
      if (node === undefined) return;
      queryClient.setQueryData(fdmDashboardQueryKey({ node, filters, axisMap }), next);
    },
  };
});
