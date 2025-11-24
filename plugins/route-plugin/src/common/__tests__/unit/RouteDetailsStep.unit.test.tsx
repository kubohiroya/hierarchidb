import { describe, expect, vi, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteDetailsStep } from '../components/RouteDetailsStep.js';
import { RouteType, TransportMode, type RouteEntity, type RouteDraft, type NodeId } from '../types/index.js';
import { createRouteDraftBase, mergeRouteDraft } from '../utils/draft.js';
import { en as enTranslations } from '../i18n/en.js';
import "@testing-library/jest-dom/vitest";

vi.mock('../i18n/index.js', () => ({
  useTranslation: () => ({
    translations: enTranslations,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const createDraft = (overrides: Partial<RouteEntity> = {}): RouteDraft => {
  const base = createRouteDraftBase('route-node-1' as NodeId);
  return mergeRouteDraft(base, overrides);
};

describe('RouteDetailsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders draft values for route configuration fields', () => {
    const draft = createDraft({
      routeType: RouteType.ROAD,
      transportModes: [TransportMode.CAR, TransportMode.BUS],
      category: 'logistics',
    });

    render(
      <RouteDetailsStep
        draft={draft}
        onUpdate={vi.fn()}
        onValidationChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('road')).toBeInTheDocument();
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Bus')).toBeInTheDocument();
  });

  it('emits updates when route type changes', () => {
    const onUpdate = vi.fn();
    const draft = createDraft({ routeType: RouteType.ROAD });

    render(
      <RouteDetailsStep
        draft={draft}
        onUpdate={onUpdate}
        onValidationChange={vi.fn()}
      />,
    );

    const routeTypeSelect = screen.getByLabelText('Route Type');
    fireEvent.change(routeTypeSelect, { target: { value: RouteType.AIRWAY } });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.routeType).toBe(RouteType.AIRWAY);
    expect(typeof payload.updatedAt).toBe('number');
  });
});
