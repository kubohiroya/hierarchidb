import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { RouteSelectionStep } from '../components/RouteSelectionStep.js';
import type { RouteWorkingCopy } from '../types/index.js';
import { en as enTranslations } from '../i18n/en.js';

vi.mock('../i18n/index.js', () => ({
  useTranslation: () => ({
    translations: enTranslations,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const createWorkingCopy = (overrides: Partial<RouteWorkingCopy> = {}): RouteWorkingCopy => ({
  treeNodeId: 'route-node-1' as any,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  draft: {},
  payload: { stage: 'draft', draft: {} },
  ...overrides,
});

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
