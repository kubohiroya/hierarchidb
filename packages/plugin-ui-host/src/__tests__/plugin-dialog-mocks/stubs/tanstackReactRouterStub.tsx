import React from 'react';

type LinkProps = React.ComponentProps<'a'> & {
  to?: string | { to?: string };
};

export function useLocation() {
  return {
    pathname: '/d/r/page-node/target-node/shape/edit/normal/1',
    searchStr: '',
    hash: '',
  };
}

export function useNavigate() {
  return () => Promise.resolve();
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, children, ...rest }, ref) => {
    const href = typeof to === 'string' ? to : (to?.to ?? '#');
    return React.createElement('a', { ref, href, ...rest }, children);
  }
);
