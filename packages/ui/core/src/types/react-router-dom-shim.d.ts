declare module 'react-router-dom' {
  import * as React from 'react';

  export interface LocationLike {
    pathname: string;
    search: string;
    hash: string;
    state?: unknown;
    key?: string;
  }

  export const Link: React.FC<
    React.ComponentProps<'a'> & {
      to: string;
      replace?: boolean;
      state?: unknown;
      relative?: 'path' | 'route';
      preventScrollReset?: boolean;
      viewTransition?: boolean;
    }
  >;

  export function useLocation(): LocationLike;
}

