import { createElement, type ComponentType } from 'react';
import type { StepComponent } from '@hierarchidb/plugin-service-api';

export const wrapDialogStepComponent = <TProps extends object>(
  Component: ComponentType<TProps>,
): StepComponent => {
  return (...args: unknown[]) => {
    const [props] = args;
    return createElement<TProps>(Component, (props ?? {}) as TProps);
  };
};
