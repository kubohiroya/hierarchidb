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
        buildAvailabilitySummary: 'Build already running',
        buildAvailabilityTooltip: 'Build blocked',
        onBuild: vi.fn(),
      })
    );

    expect(result.current.showBuildEntry).toBe(true);
    expect(result.current.buildDisabled).toBe(true);
    expect(result.current.buildAvailabilitySummary).toBe('Build already running');
    expect(result.current.buildAvailabilityTooltip).toBe('Build blocked');
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
        buildAvailabilitySummary: 'Up to date',
        onBuild: vi.fn(),
      })
    );

    expect(result.current.showBuildEntry).toBe(true);
    expect(result.current.buildDisabled).toBe(true);
    expect(result.current.buildAvailabilitySummary).toBe('Up to date');
  });

  it('keeps a disabled Build entry visible for folders with availability reasons', () => {
    const { result } = renderHook(() =>
      useNodeContextMenu({
        anchorEl: document.createElement('button'),
        open: true,
        onClose: () => {},
        nodeId: 'folder-1',
        nodeType: 'folder-plugin',
        buildRequired: false,
        canBuild: false,
        buildAvailabilitySummary: 'No build target',
        buildAvailabilityTooltip: 'Build unavailable',
        buildDiagnosticsLabel: 'Build diagnostics',
        onBuild: vi.fn(),
        onBuildDiagnostics: vi.fn(),
      })
    );

    expect(result.current.showBuildEntry).toBe(true);
    expect(result.current.buildDisabled).toBe(true);
    expect(result.current.buildAvailabilitySummary).toBe('No build target');
    expect(result.current.buildAvailabilityTooltip).toBe('Build unavailable');
    expect(result.current.buildDiagnosticsLabel).toBe('Build diagnostics');
  });

  it('exposes diagnostics entry state only when a diagnostics handler exists', () => {
    const { result: withoutHandler } = renderHook(() =>
      useNodeContextMenu({
        anchorEl: document.createElement('button'),
        open: true,
        onClose: () => {},
        nodeId: 'folder-1',
        nodeType: 'folder-plugin',
        buildDiagnosticsLabel: 'Build diagnostics',
        onBuild: vi.fn(),
      })
    );
    expect(withoutHandler.current.buildDiagnosticsLabel).toBeUndefined();

    const { result: withHandler } = renderHook(() =>
      useNodeContextMenu({
        anchorEl: document.createElement('button'),
        open: true,
        onClose: () => {},
        nodeId: 'folder-1',
        nodeType: 'folder-plugin',
        buildDiagnosticsLabel: 'Build diagnostics',
        onBuild: vi.fn(),
        onBuildDiagnostics: vi.fn(),
      })
    );
    expect(withHandler.current.buildDiagnosticsLabel).toBe('Build diagnostics');
  });
});
