// Ambient UI type declarations shared across packages
// Centralizing these avoids per-package local shims that dep-fence flags。

// react-transition-group re-exports -------------------------------------------------

declare module 'react-transition-group' {
  import type { Component, ReactNode, Ref } from 'react';

  type RefHandler<
    RefElement extends undefined | HTMLElement,
    ImplicitRefHandler extends (node: HTMLElement, ...args: any[]) => void,
    ExplicitRefHandler extends (...args: any[]) => void
  > = {
    implicit: ImplicitRefHandler;
    explicit: ExplicitRefHandler;
  }[RefElement extends undefined ? 'implicit' : 'explicit'];

  export type EndHandler<RefElement extends undefined | HTMLElement> = RefHandler<
    RefElement,
    (node: HTMLElement, done: () => void) => void,
    (done: () => void) => void
  >;

  export type EnterHandler<RefElement extends undefined | HTMLElement> = RefHandler<
    RefElement,
    (node: HTMLElement, isAppearing: boolean) => void,
    (isAppearing: boolean) => void
  >;

  export type ExitHandler<RefElement extends undefined | HTMLElement> = RefHandler<
    RefElement,
    (node: HTMLElement) => void,
    () => void
  >;

  export const UNMOUNTED: 'unmounted';
  export const EXITED: 'exited';
  export const ENTERING: 'entering';
  export const ENTERED: 'entered';
  export const EXITING: 'exiting';

  export interface TransitionActions {
    appear?: boolean | undefined;
    enter?: boolean | undefined;
    exit?: boolean | undefined;
  }

  interface BaseTransitionProps<RefElement extends undefined | HTMLElement> extends TransitionActions {
    in?: boolean | undefined;
    mountOnEnter?: boolean | undefined;
    unmountOnExit?: boolean | undefined;
    onEnter?: EnterHandler<RefElement> | undefined;
    onEntering?: EnterHandler<RefElement> | undefined;
    onEntered?: EnterHandler<RefElement> | undefined;
    onExit?: ExitHandler<RefElement> | undefined;
    onExiting?: ExitHandler<RefElement> | undefined;
    onExited?: ExitHandler<RefElement> | undefined;
    children?: TransitionChildren | undefined;
    nodeRef?: Ref<RefElement> | undefined;
    [prop: string]: unknown;
  }

  export type TransitionStatus =
    | typeof ENTERING
    | typeof ENTERED
    | typeof EXITING
    | typeof EXITED
    | typeof UNMOUNTED;

  export type TransitionChildren =
    | ReactNode
    | ((status: TransitionStatus, childProps?: Record<string, unknown>) => ReactNode);

  export interface TimeoutProps<RefElement extends undefined | HTMLElement>
    extends BaseTransitionProps<RefElement> {
    timeout: number | { appear?: number | undefined; enter?: number | undefined; exit?: number | undefined };
    addEndListener?: EndHandler<RefElement> | undefined;
  }

  export interface EndListenerProps<RefElement extends undefined | HTMLElement>
    extends BaseTransitionProps<RefElement> {
    timeout?: number | { appear?: number | undefined; enter?: number | undefined; exit?: number | undefined } | undefined;
    addEndListener: EndHandler<RefElement>;
  }

  export type TransitionProps<RefElement extends undefined | HTMLElement = undefined> =
    | TimeoutProps<RefElement>
    | EndListenerProps<RefElement>;

  class Transition<RefElement extends HTMLElement | undefined> extends Component<TransitionProps<RefElement>> {}

  export default Transition;
}

declare module 'react-transition-group/Transition' {
  import Transition, {
    type TransitionProps,
    type TransitionActions,
    type TransitionStatus,
    type TransitionChildren,
    type EndHandler,
    type EnterHandler,
    type ExitHandler,
  } from 'react-transition-group';

  export default Transition;
  export type {
    TransitionProps,
    TransitionActions,
    TransitionStatus,
    TransitionChildren,
    EndHandler,
    EnterHandler,
    ExitHandler,
  };
}

// CSS Modules (e.g., *.module.css)
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// MapLibre CSS import module
declare module 'maplibre-gl/dist/maplibre-gl.css';

// (UI packages export正式d.ts; no ambient shim required)
