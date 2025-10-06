import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { RouteSelectionStep } from '../components/RouteSelectionStep.js';
import type { RouteEntity, RouteWorkingCopy, NodeId } from '../types/index.js';
import { createRouteDraftWorkingCopy, mergeRouteWorkingCopy } from '../utils/workingCopy.js';
import { en as enTranslations } from '../i18n/en.js';

vi.mock('../i18n/index.js', () => ({
  useTranslation: () => ({
    translations: enTranslations,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const createWorkingCopy = (overrides: Partial<RouteEntity> = {}): RouteWorkingCopy => {
  const base = createRouteDraftWorkingCopy('route-node-1' as NodeId);
  return mergeRouteWorkingCopy(base, overrides);
};

describe('RouteSelectionStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('invokes onUpdate when calculating a route', async () => {
    const onUpdate = vi.fn();

    render(
      <RouteSelectionStep
        workingCopy={createWorkingCopy()}
        onUpdate={onUpdate}
        onValidationChange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Calculate Route' });
    fireEvent.click(button);

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0][0];
    expect(payload).toHaveProperty('waypoints');
    expect(Array.isArray(payload.waypoints)).toBe(true);
  });
});
