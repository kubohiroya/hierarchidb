import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../../../common/types/constants';
import { useGeometryConfigSectionState } from '../../../components/build-config/useGeometryConfigSectionState';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('useGeometryConfigSectionState', () => {
  it('exposes persisted border geometry config without a UI mutation callback', () => {
    const onChange = vi.fn();
    const config = {
      ...DEFAULT_BUILD_CONFIG,
      borderGeometryConfig: {
        enabled: true,
        simplifyTolerance: 0.0001,
      },
    };
    const { result } = renderHook(() =>
      useGeometryConfigSectionState({
        config,
        onChange,
      })
    );

    expect(result.current.borderGeometryConfig).toEqual({
      enabled: true,
      simplifyTolerance: 0.0001,
    });
    expect(Object.hasOwn(result.current, 'onBorderGeometryUpdate')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
