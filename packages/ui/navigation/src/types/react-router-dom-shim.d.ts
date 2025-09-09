declare module 'react-router-dom' {
  import * as React from 'react';
  export const Link: React.FC<React.ComponentProps<'a'> & { to: string }>;
  export const NavLink: React.FC<React.ComponentProps<'a'> & { to: string }>;

  export function useLocation(): { pathname: string; search: string; hash: string; state?: unknown; key?: string };
}
