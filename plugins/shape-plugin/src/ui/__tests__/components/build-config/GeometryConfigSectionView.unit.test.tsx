import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import type {
  ShapeBuildBorderGeometryConfig,
  ShapeBuildGeometryConfig,
} from '../../../../common/types/BuildTaskResult.js';
import { DEFAULT_BUILD_CONFIG } from '../../../../common/types/constants.js';
import { GeometryConfigSectionView } from '../../../components/build-config/GeometryConfigSectionView.js';

vi.mock('../../../components/build-config/SimplifyToleranceByAdminLevelCard.tsx', () => ({
  SimplifyToleranceByAdminLevelCard: () => null,
}));

const t = ((_key: string, fallback?: string) => fallback ?? _key) as TFunction;

describe('GeometryConfigSectionView', () => {
  it('keeps persisted shared-arc values visible while disabling both controls', () => {
    const baseGeometryConfig = structuredClone(
      DEFAULT_BUILD_CONFIG.geometryConfig
    ) as ShapeBuildGeometryConfig;
    const borderGeometryConfig: ShapeBuildBorderGeometryConfig = {
      enabled: true,
      simplifyTolerance: 0.0001,
    };

    render(
      <GeometryConfigSectionView
        t={t}
        disabled={false}
        disableHoverLift={false}
        hoverCardSx={{}}
        baseGeometryConfig={baseGeometryConfig}
        borderGeometryConfig={borderGeometryConfig}
        simplifyAlgorithm="topojson"
        preserveTopology
        summaryHelp="Geometry settings"
        handleSimplifyAlgorithmChange={vi.fn()}
        handlePreserveTopologyChange={vi.fn()}
        onGeometryUpdate={vi.fn()}
      />
    );

    const sharedArcSwitch = screen.getByRole('switch', {
      name: 'Build shared-arc topology artifacts',
    });
    const simplifyToleranceInput = screen.getByRole('spinbutton', {
      name: 'Arc simplify tolerance',
    });

    expect(sharedArcSwitch).toBeChecked();
    expect(sharedArcSwitch).toBeDisabled();
    expect(simplifyToleranceInput).toBeDisabled();
    expect(simplifyToleranceInput).toHaveValue(0.0001);

    fireEvent.click(sharedArcSwitch);
    fireEvent.change(simplifyToleranceInput, { target: { value: '0.0002' } });

    expect(sharedArcSwitch).toBeChecked();
    expect(simplifyToleranceInput).toHaveValue(0.0001);
  });
});
