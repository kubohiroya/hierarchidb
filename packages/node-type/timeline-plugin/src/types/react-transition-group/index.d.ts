import type { ComponentClass, ReactNode, RefObject } from 'react';

export type TransitionStatus = 'entering' | 'entered' | 'exiting' | 'exited' | 'unmounted';

export interface TransitionActions {
  appear?: boolean;
  enter?: boolean;
  exit?: boolean;
}

export interface TimeoutProps {
  appear?: number;
  enter?: number;
  exit?: number;
}

export interface TransitionProps extends TransitionActions {
  in?: boolean;
  mountOnEnter?: boolean;
  unmountOnExit?: boolean;
  timeout: number | TimeoutProps;
  easing?: string | {
    appear?: string;
    enter?: string;
    exit?: string;
  };
  addEndListener?: (node: Element, done: () => void) => void;
  onEnter?: (node: Element, isAppearing: boolean) => void;
  onEntering?: (node: Element, isAppearing: boolean) => void;
  onEntered?: (node: Element, isAppearing: boolean) => void;
  onExit?: (node: Element) => void;
  onExiting?: (node: Element) => void;
  onExited?: (node: Element) => void;
  nodeRef?: RefObject<Element>;
  children?: ReactNode | ((status: TransitionStatus, props: TransitionProps) => ReactNode);
}

export type TransitionComponent = ComponentClass<TransitionProps>;

declare const Transition: TransitionComponent;
export default Transition;
