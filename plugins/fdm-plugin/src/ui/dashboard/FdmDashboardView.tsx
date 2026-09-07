import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { useHydrateAtoms } from 'jotai/react/utils';
import { createStore } from 'jotai/vanilla';
import { queryClientAtom } from 'jotai-tanstack-query';
import { type ReactNode, useMemo, useState } from 'react';
import { FdmDashboardPresentation } from './FdmDashboardPresentation.js';
import type { FdmDashboardViewProps } from './fdmDashboardViewTypes.js';
import { useFdmDashboardController } from './useFdmDashboardController.js';

export function FdmDashboardView(props: FdmDashboardViewProps) {
  const store = useMemo(() => createStore(), []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <HydrateQueryClient queryClient={queryClient}>
          <FdmDashboardViewBody {...props} />
        </HydrateQueryClient>
      </JotaiProvider>
    </QueryClientProvider>
  );
}

function HydrateQueryClient({
  queryClient,
  children,
}: {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}) {
  useHydrateAtoms([[queryClientAtom, queryClient]] as const);
  return children;
}

function FdmDashboardViewBody(props: FdmDashboardViewProps) {
  const { state, actions } = useFdmDashboardController(props);
  return <FdmDashboardPresentation state={state} actions={actions} disabled={props.disabled} />;
}
