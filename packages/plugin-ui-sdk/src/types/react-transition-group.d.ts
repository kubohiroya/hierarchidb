declare module 'react-transition-group/Transition' {
  import type * as React from 'react';

  export interface TransitionActions {
    appear?: boolean;
    enter?: boolean;
    exit?: boolean;
  }

  export type TransitionHandlerKeys =
    | 'onEnter'
    | 'onEntering'
    | 'onEntered'
    | 'onExit'
    | 'onExiting'
    | 'onExited';

  export interface TransitionProps extends TransitionActions, React.HTMLAttributes<HTMLElement> {
    in?: boolean;
    mountOnEnter?: boolean;
    unmountOnExit?: boolean;
    timeout?: number | { enter?: number; exit?: number; appear?: number };
    addEndListener?: (...args: any[]) => any;
    onEnter?: (node: Element, isAppearing?: boolean) => void;
    onEntering?: (node: Element, isAppearing?: boolean) => void;
    onEntered?: (node: Element, isAppearing?: boolean) => void;
    onExit?: (node: Element) => void;
    onExiting?: (node: Element) => void;
    onExited?: (node: Element) => void;
  }

  export type TransitionActionsType = TransitionActions;
  export type TransitionPropsType = TransitionProps;

  const Transition: React.ComponentType<TransitionProps>;
  export default Transition;
  export type TransitionActionsAlias = TransitionActions;
}
