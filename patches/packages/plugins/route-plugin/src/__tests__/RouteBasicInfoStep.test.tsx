import { describe, expect, vi, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RouteBasicInfoStep } from '../components/RouteBasicInfoStep.js';
import { RouteType, TransportMode, type RouteWorkingCopy } from '../types/index.js';
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

describe('RouteBasicInfoStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers values provided via payload.draft', () => {
    const workingCopy = createWorkingCopy({
      payload: {
        stage: 'draft',
        draft: {
          name: 'Draft Route',
          description: 'Draft description',
          routeType: RouteType.ROAD,
          transportModes: [TransportMode.CAR, TransportMode.BUS],
          category: 'logistics',
          tags: ['draft-tag'],
          version: 4,
        },
      },
    });

    render(
      <RouteBasicInfoStep
        workingCopy={workingCopy}
        onUpdate={vi.fn()}
        onValidationChange={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Route Name') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText('Description') as HTMLInputElement;
    const tagsInput = screen.getByLabelText('Tags') as HTMLInputElement;

    expect(nameInput.value).toBe('Draft Route');
    expect(descriptionInput.value).toBe('Draft description');
    expect(tagsInput.value).toBe('draft-tag');
    expect(screen.getByText('Car')).toBeInTheDocument();
    expect(screen.getByText('Bus')).toBeInTheDocument();
  });

  it('emits updates with incremented version and timestamp', () => {
    const onUpdate = vi.fn();
    const workingCopy = createWorkingCopy({
      payload: {
        stage: 'draft',
        draft: {
          name: 'Draft Route',
          version: 1,
        },
      },
    });

    render(
      <RouteBasicInfoStep
        workingCopy={workingCopy}
        onUpdate={onUpdate}
        onValidationChange={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Route Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Route' } });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.name).toBe('Updated Route');
    expect(typeof payload.updatedAt).toBe('number');
    expect(payload.version).toBe(2);
  });
});
