import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../../../common/types/constants';
import { useGeometryConfigSectionState } from '../../../components/build-config/useGeometryConfigSectionState';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('useGeometryConfigSectionState', () => {
  it('propagates border geometry config updates through build config patching', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useGeometryConfigSectionState({
        config: DEFAULT_BUILD_CONFIG,
        onChange,
      })
    );

    expect(result.current.borderGeometryConfig).toEqual({
      enabled: false,
      simplifyTolerance: 0,
    });

    act(() => {
      result.current.onBorderGeometryUpdate({
        enabled: true,
        simplifyTolerance: 0.0001,
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updater = onChange.mock.calls[0]?.[0];
    expect(updater).toEqual(expect.any(Function));

    const nextConfig = updater(DEFAULT_BUILD_CONFIG);
    expect(nextConfig.borderGeometryConfig).toEqual({
      enabled: true,
      simplifyTolerance: 0.0001,
    });
  });
});
