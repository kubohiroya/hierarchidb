import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNodeContextMenu } from '../useNodeContextMenu';

vi.mock('@hierarchidb/components', () => ({
  useIconRegistry: () => ({
    resolveIcon: () => null,
  }),
}));

vi.mock('@hierarchidb/ui-i18n', () => ({
  useGlobalI18nTranslator: () => ({
    language: 'en',
    t: (_key: string, fallback: string) => fallback,
  }),
}));

describe('useNodeContextMenu build entry state', () => {
  it('shows a disabled Build entry when a required build target is currently blocked', () => {
    const { result } = renderHook(() =>
      useNodeContextMenu({
        anchorEl: document.createElement('button'),
        open: true,
        onClose: () => {},
        nodeId: 'shape-1',
        nodeType: 'shape',
        buildRequired: true,
        canBuild: false,
        onBuild: vi.fn(),
      })
    );

    expect(result.current.showBuildEntry).toBe(true);
    expect(result.current.buildDisabled).toBe(true);
  });

  it('keeps a disabled Build entry visible for buildable targets with no required rebuild', () => {
    const { result } = renderHook(() =>
      useNodeContextMenu({
        anchorEl: document.createElement('button'),
        open: true,
        onClose: () => {},
        nodeId: 'shape-1',
        nodeType: 'shape',
        buildRequired: false,
        canBuild: false,
        onBuild: vi.fn(),
      })
    );

    expect(result.current.showBuildEntry).toBe(true);
    expect(result.current.buildDisabled).toBe(true);
  });
});
