import { type ReactNode } from 'react';

export const InlineIcon = (props: { children: ReactNode }) => {
  return (
    <span
      style={{
        display: 'inline',
        verticalAlign: 'middle',
        position: 'relative',
        top: 2,
        marginRight: 2,
        marginLeft: 4,
      }}
    >
      {props.children}
    </span>
  );
};
