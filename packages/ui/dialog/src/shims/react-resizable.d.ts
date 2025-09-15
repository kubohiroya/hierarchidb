declare module 'react-resizable' {
  import * as React from 'react';

  export interface ResizableProps {
    width: number;
    height: number;
    onResize?: (e: any, data: { size: { width: number; height: number } }) => void;
    resizeHandles?: Array<'s' | 'e' | 'se' | 'w' | 'n' | 'ne' | 'sw' | 'nw'>;
    minConstraints?: [number, number];
    maxConstraints?: [number, number];
    children?: React.ReactNode;
  }

  export const Resizable: React.ComponentType<ResizableProps>;
}

