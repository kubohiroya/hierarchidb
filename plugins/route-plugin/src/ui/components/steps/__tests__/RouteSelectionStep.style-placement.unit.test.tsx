import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@hierarchidb/ui-auth', () => ({
  AuthReadyGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@hierarchidb/ui-country-select', () => ({
  CountryMatrixSelector: () => <div data-testid="country-matrix">matrix</div>,
}));

vi.mock('../../../common/i18n/index.js', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
  }),
}));

vi.mock('../useRouteSelectionStep.js', () => ({
  ROUTE_MODE_COLUMNS: [
    { id: 'airway', labelKey: 'transportModes.air', icon: () => null },
  ],
  ROUTE_STYLE_OPTIONS: [
    { id: 'solid', labelKey: 'routeConfig.style.lineStyle.solid', fallback: 'Solid' },
  ],
  LINE_WIDTH_MIN: 1,
  LINE_WIDTH_MAX: 8,
  useRouteSelectionStep: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
    translations: null,
    iso: {
      status: 'ready',
      countries: [{ code: 'JP', name: 'Japan', nativeName: 'Japan', continent: 'AS' }],
    },
    draft: {},
    dataSourceName: 'ide-gsm',
    isIdeGsm: true,
    coverage: { coverageByCountry: { JP: ['airway'] }, errors: [] },
    coverageLoading: false,
    selectionErrorMessage: null,
    errorDialogOpen: false,
    setErrorDialogOpen: vi.fn(),
    errorRows: [],
    errorColumns: [],
    matrixConfig: {
      columns: [{ id: 'airway' }],
      virtualization: { rowHeight: 40, overscan: 8 },
    },
    currentSelections: [],
    applySelections: vi.fn(),
    isCellEnabledForCountry: () => true,
    policy: { defaultChecked: null },
    styleConfig: {
      modeColors: { airway: '#1f77b4' },
      lineWidth: 2,
      lineStyle: 'solid',
    },
    handleModeColorChange: vi.fn(),
    handleLineWidthChange: vi.fn(),
    handleLineStyleChange: vi.fn(),
  }),
}));

import { RouteSelectionStep } from '../RouteSelectionStep';

describe('RouteSelectionStep style placement', () => {
  it('does not render route style controls in Step3', () => {
    render(
      <RouteSelectionStep
        draft={{}}
        onUpdate={() => undefined}
        onValidationChange={() => undefined}
        mode="create"
      />,
    );

    expect(screen.getByTestId('country-matrix')).toBeTruthy();
    expect(screen.queryByText('Route style')).toBeNull();
    expect(screen.queryByText('Mode colors')).toBeNull();
    expect(screen.queryByText('Line width')).toBeNull();
    expect(screen.queryByText('Line style')).toBeNull();
  });
});
