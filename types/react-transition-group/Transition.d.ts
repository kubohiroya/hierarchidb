declare module 'react-transition-group/Transition' {
  import type { ComponentType, ReactNode, Ref } from 'react';

  export type TransitionStatus = 'entering' | 'entered' | 'exiting' | 'exited' | 'unmounted';

  export type TransitionActions = {
    onEnter?: (node: Element, isAppearing: boolean) => void;
    onEntering?: (node: Element, isAppearing: boolean) => void;
    onEntered?: (node: Element, isAppearing: boolean) => void;
    onExit?: (node: Element) => void;
    onExiting?: (node: Element) => void;
    onExited?: (node: Element) => void;
  };

  export interface TransitionProps extends TransitionActions {
    in?: boolean;
    mountOnEnter?: boolean;
    unmountOnExit?: boolean;
    appear?: boolean;
    enter?: boolean;
    exit?: boolean;
    timeout?: number | { enter?: number; exit?: number; appear?: number };
    addEndListener?: (node: Element, done: () => void) => void;
    nodeRef?: Ref<unknown>;
    children?: ReactNode | ((status: TransitionStatus, childProps: Record<string, unknown>) => ReactNode);
  }

  const Transition: ComponentType<TransitionProps>;
  export default Transition;
}
