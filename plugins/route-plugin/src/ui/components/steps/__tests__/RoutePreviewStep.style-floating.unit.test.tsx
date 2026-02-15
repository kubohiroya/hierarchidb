import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@hierarchidb/ui-map', () => ({
  DEFAULT_MAP_CONFIG: {
    mapStyleUrl: '',
    interactionOptions: {},
  },
  MapToggleCard: ({ title }: { title: string }) => <div>{title}</div>,
  ResourceLayerMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  RoutePreviewList: () => <div>preview-list</div>,
}));

vi.mock('../useRoutePreviewStep.js', () => ({
  useRoutePreviewStep: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
    mapInstance: null,
    setMapInstance: vi.fn(),
    attributionItems: [],
    initialViewState: { longitude: 0, latitude: 0, zoom: 2 },
    vectorLayers: [],
    hoverSnackbarProps: { open: false, message: '' },
    showMissingGeometry: false,
    lineStringsError: null,
    lineStringsLoading: false,
    hasGeometry: true,
    routeModeOptions: [],
    routeModeSelection: {},
    handleRouteModeToggle: vi.fn(),
    listRows: [],
    listSearch: '',
    setListSearch: vi.fn(),
    matchedIdSet: new Set<string>(),
    selectedIds: [],
    setSelectedIds: vi.fn(),
    staleSummaryById: new Map(),
    emptyContentProps: undefined,
    modeMeta: {},
    columnLabels: {
      lineId: 'Line Id',
      routeMode: 'Mode',
      routeName: 'Route Name',
      startName: 'Start',
      startAdmin0: 'Start Admin0',
      startAdmin1: 'Start Admin1',
      startAdmin2: 'Start Admin2',
      endName: 'End',
      endAdmin0: 'End Admin0',
      endAdmin1: 'End Admin1',
      endAdmin2: 'End Admin2',
      waypointCount: 'Waypoints',
      distanceMeters: 'Distance (m)',
    },
    countLabels: { matched: 'Matched', rows: 'Rows' },
    searchLabels: { placeholder: 'Search routes', ariaLabel: 'Search routes' },
    statusLabels: { failed: 'Failed', completed: 'Completed' },
    errorColumnLabels: { status: 'Status', errorCount: 'Errors', errorMessage: 'Error Message' },
    routeStyleConfig: {
      modeColors: {
        airway: '#1f77b4',
        waterway: '#17becf',
        railway: '#ff7f0e',
        'high-speed-rail': '#d62728',
        road: '#2ca02c',
        highway: '#9467bd',
      },
      lineWidth: 2,
      lineStyle: 'solid',
    },
    modeWindow: {
      windowState: {
        position: { x: 96, y: 96 },
        size: { width: 260, height: 220 },
        isVisible: true,
        isMinimized: false,
        isFullscreen: false,
        zIndex: 1000,
      },
      handlers: {
        onStateChange: vi.fn(),
        onClose: vi.fn(),
        onMinimize: vi.fn(),
        onRestore: vi.fn(),
        setPosition: vi.fn(),
        setSize: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
      },
    },
    showModeWindowButton: false,
    listWindow: {
      windowState: {
        position: { x: 96, y: 356 },
        size: { width: 640, height: 280 },
        isVisible: true,
        isMinimized: false,
        isFullscreen: false,
        zIndex: 1000,
      },
      handlers: {
        onStateChange: vi.fn(),
        onClose: vi.fn(),
        onMinimize: vi.fn(),
        onRestore: vi.fn(),
        setPosition: vi.fn(),
        setSize: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
      },
    },
    showListWindowButton: false,
    styleWindow: {
      windowState: {
        position: { x: 640, y: 96 },
        size: { width: 320, height: 420 },
        isVisible: true,
        isMinimized: false,
        isFullscreen: false,
        zIndex: 1000,
      },
      handlers: {
        onStateChange: vi.fn(),
        onClose: vi.fn(),
        onMinimize: vi.fn(),
        onRestore: vi.fn(),
        setPosition: vi.fn(),
        setSize: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
      },
    },
    showStyleWindowButton: false,
    handleModeColorChange: vi.fn(),
    handleLineWidthChange: vi.fn(),
    handleLineStyleChange: vi.fn(),
    metadataSyncSummary: null,
    metadataSyncRunning: false,
    metadataSyncError: null,
    metadataSyncBadgeText: '',
    runMetadataSyncCheck: vi.fn(),
    buildErrors: [],
  }),
}));

import { RoutePreviewStep } from '../RoutePreviewStep.js';

describe('RoutePreviewStep style floating window', () => {
  it('renders route style controls in preview overlay', () => {
    render(<RoutePreviewStep draft={{}} nodeId="route-node-1" onUpdate={() => undefined} />);

    expect(screen.getByText('Route mode filters')).toBeTruthy();
    expect(screen.getByText('Route metadata')).toBeTruthy();
    expect(screen.getByText('Route style')).toBeTruthy();
    expect(screen.getByText('Mode colors')).toBeTruthy();
    expect(screen.getByText('Line width')).toBeTruthy();
    expect(screen.getByText('Line style')).toBeTruthy();
  });
});
