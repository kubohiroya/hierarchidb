import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RouteSelectionStep } from '~/common/__tests__/components/RouteSelectionStep';
import type { RouteEntity, RouteUpdaterPayload, NodeId } from '~/common/__tests__/types/index';
import { createRouteUpdaterPayloadBase, mergeRouteUpdaterPayload } from '~/common/__tests__/utils/draft';
import { en as enTranslations } from '~/common/__tests__/i18n/en';

vi.mock('../i18n/index.js', () => ({
  useTranslation: () => ({
    translations: enTranslations,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const createDraft = (overrides: Partial<RouteEntity> = {}): RouteUpdaterPayload => {
  const base = createRouteUpdaterPayloadBase('route-node-1' as NodeId);
  return mergeRouteUpdaterPayload(base, overrides);
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
        draft={createDraft()}
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
