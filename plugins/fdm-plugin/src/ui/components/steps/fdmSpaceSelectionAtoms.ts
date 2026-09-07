import type { FdmSpaceCatalog } from '@hierarchidb/fdm-api';
import type {
  IdeGsmConnectionHealthResult,
  IdeGsmConnectionInput,
} from '@hierarchidb/ui-ide-gsm-connection';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { atom, type Getter } from 'jotai';
import { atomWithMutation, atomWithQuery, queryClientAtom } from 'jotai-tanstack-query';
import type { FdmPluginRuntime } from '../fdmStepProviderTypes.js';

export const fdmSpaceSelectionRuntimeAtom = atom<FdmPluginRuntime | undefined>(undefined);
export const fdmSpaceSelectionConnectionAtom = atom<IdeGsmConnectionInput | null>(null);
export const fdmSpaceSelectionHealthAtom = atom<IdeGsmConnectionHealthResult>({
  status: 'incomplete',
});

export function fdmSpaceCatalogQueryKey(connectionName: string): QueryKey {
  return ['fdm-space-catalog', connectionName];
}

export const fdmSpaceCatalogQueryAtom = atomWithQuery((get: Getter) => {
  const runtime = get(fdmSpaceSelectionRuntimeAtom);
  const persistedConnection = get(fdmSpaceSelectionConnectionAtom);
  const health = get(fdmSpaceSelectionHealthAtom);
  const fdmRuntime = runtime?.fdmRuntime;
  const connectionName = persistedConnection?.connectionName ?? '';
  return {
    queryKey: fdmSpaceCatalogQueryKey(connectionName),
    enabled:
      fdmRuntime !== undefined && persistedConnection !== null && health.status === 'healthy',
    queryFn: ({ signal }): Promise<FdmSpaceCatalog> => {
      if (fdmRuntime === undefined || persistedConnection === null) {
        throw new Error('FDM_SPACE_RUNTIME_NOT_READY');
      }
      return fdmRuntime.listSpaces(persistedConnection.connectionName, signal);
    },
  };
});

export const fdmSpaceCreateMutationAtom = atomWithMutation<string, string, Error>((get: Getter) => {
  const runtime = get(fdmSpaceSelectionRuntimeAtom);
  const persistedConnection = get(fdmSpaceSelectionConnectionAtom);
  const queryClient = get(queryClientAtom) as QueryClient;
  return {
    mutationKey: ['fdm-space-create', persistedConnection?.connectionName ?? ''],
    mutationFn: async (requestedName): Promise<string> => {
      const fdmRuntime = runtime?.fdmRuntime;
      if (fdmRuntime?.createSpace === undefined || persistedConnection === null) {
        throw new Error('FDM_SPACE_CREATE_UNAVAILABLE');
      }
      const created = await fdmRuntime.createSpace({
        connectionName: persistedConnection.connectionName,
        requestedName,
        signal: new AbortController().signal,
      });
      return created.spaceId;
    },
    onSuccess: () => {
      if (persistedConnection === null) return;
      void queryClient.invalidateQueries({
        queryKey: fdmSpaceCatalogQueryKey(persistedConnection.connectionName),
      });
    },
  };
});
