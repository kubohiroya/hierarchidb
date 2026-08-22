import type { NodeId } from '@hierarchidb/core-types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShapeCountrySelectionStep } from '../../../components/country-selection/ShapeCountrySelectionStep.js';

const mocks = vi.hoisted(() => ({
  reloadAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@hierarchidb/ui-auth', () => ({
  AuthReadyGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  CountryMatrixSelector: () => null,
}));

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { message?: string }) =>
      fallback.replace('{{message}}', options?.message ?? ''),
  }),
}));

vi.mock('../../../components/country-selection/useShapeCountrySelectionContentView.js', () => ({
  useShapeCountrySelectionContentView: () => ({ metadataReloadTooltip: 'Reload' }),
}));

vi.mock('../../../components/country-selection/useShapeCountrySelectionStep.js', () => ({
  useShapeCountrySelectionStep: () => ({
    loading: false,
    error: new Error('Country availability worker failed to initialize.'),
    availabilityInfo: null,
    matrixConfig: [],
    countries: [],
    selections: {},
    applySelections: vi.fn(),
    isCellEnabled: vi.fn(),
    reloadAll: mocks.reloadAll,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShapeCountrySelectionStep worker failure', () => {
  it('shows a visible error and invokes only the explicit retry action', async () => {
    render(
      <ShapeCountrySelectionStep
        data={{}}
        onChange={vi.fn()}
        nodeId={'shape-country-selection-test' as NodeId}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Country availability worker failed to initialize.'
    );
    expect(mocks.reloadAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mocks.reloadAll).toHaveBeenCalledOnce());
  });
});
