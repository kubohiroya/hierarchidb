/**
 * Provides a reusable wrapper to coerce strongly typed React components into the
 * loose StepComponent signature expected by folder dialog extensions.
 */
import { createElement, type ComponentType } from 'react';
import type { StepComponent } from '@hierarchidb/common-type';

export const wrapDialogStepComponent = (Component: ComponentType<any>): StepComponent => {
  return (...args: unknown[]) => {
    const [props] = args;
    return createElement(Component, (props ?? {}) as Record<string, unknown>);
  };
};
