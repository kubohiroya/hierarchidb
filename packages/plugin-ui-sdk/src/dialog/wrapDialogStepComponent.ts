import { createElement, type ComponentType } from 'react';
import { StepComponent } from '../types/plugin-pointcuts.js';

export const wrapDialogStepComponent = <TProps extends object>(
  Component: ComponentType<TProps>,
): StepComponent => {
  return (...args: unknown[]) => {
    const [props] = args;
    return createElement<TProps>(Component, (props ?? {}) as TProps);
  };
};
