import { type ReactNode, startTransition, useEffect, useState } from 'react';

export type RuntimeBootstrapResult<TRuntime> =
  | Readonly<{ readonly status: 'reload-requested' }>
  | Readonly<{ readonly status: 'runtime-ready'; readonly runtime: TRuntime }>;

export interface RuntimeBootstrapOperations<TRuntime> {
  initializeRuntime(): Promise<RuntimeBootstrapResult<TRuntime>>;
  renderReadyRuntime(runtime: TRuntime): ReactNode;
  handleBootstrapFailure(error: unknown): void;
  handleUnhandledRejection(reason: unknown): void;
}

export interface RuntimeBootstrapProps<TRuntime> {
  operations: RuntimeBootstrapOperations<TRuntime>;
}

type RuntimeBootstrapState<TRuntime> =
  | Readonly<{ readonly status: 'pending' }>
  | Readonly<{ readonly status: 'ready'; readonly runtime: TRuntime }>;

export function RuntimeBootstrap<TRuntime>({ operations }: RuntimeBootstrapProps<TRuntime>) {
  const [state, setState] = useState<RuntimeBootstrapState<TRuntime>>({ status: 'pending' });

  useEffect(() => {
    let active = true;
    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      if (!active) return;
      operations.handleUnhandledRejection(event.reason);
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    operations
      .initializeRuntime()
      .then((result) => {
        if (!active || result.status === 'reload-requested') return;
        startTransition(() => {
          if (active) {
            setState({ status: 'ready', runtime: result.runtime });
          }
        });
      })
      .catch((error: unknown) => {
        if (active) {
          operations.handleBootstrapFailure(error);
        }
      });

    return () => {
      active = false;
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [operations]);

  return state.status === 'ready' ? operations.renderReadyRuntime(state.runtime) : null;
}
