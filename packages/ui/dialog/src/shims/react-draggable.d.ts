declare module 'react-draggable' {
  import * as React from 'react';

  export interface DraggableProps {
    handle?: string;
    cancel?: string;
    position?: { x: number; y: number };
    defaultPosition?: { x: number; y: number };
    onStop?: (e: any, data: { x: number; y: number }) => void;
    children?: React.ReactNode;
  }

  const Draggable: React.ComponentType<DraggableProps>;
  export default Draggable;
}

