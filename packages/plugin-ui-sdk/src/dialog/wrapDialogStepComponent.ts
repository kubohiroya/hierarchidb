import { type ComponentType, createElement, type ReactNode } from 'react';

type StepComponent = (...args: unknown[]) => ReactNode;

export const wrapDialogStepComponent = <TProps extends object>(
  Component: ComponentType<TProps>
): StepComponent => {
  return (...args: unknown[]) => {
    const [props] = args;
    return createElement<TProps>(Component, (props ?? {}) as TProps);
  };
};
