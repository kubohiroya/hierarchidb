import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoutePreviewHoverSnackbar } from '../RoutePreviewStepElements.js';
import type { RoutePreviewHoverMatch } from '../RoutePreviewStepElements.js';

describe('RoutePreviewHoverSnackbar', () => {
  it('calls onToggleMatchSelection when row is clicked', () => {
    const onToggleMatchSelection = vi.fn();
    const matches: RoutePreviewHoverMatch[] = [
      {
        id: 'r1',
        index: 1,
        linePath: '0,0 10,10',
        summaryLine: 'Rail / A -> B',
        routeName: 'Route 1',
        distanceLabel: '100m',
        modeColor: '#1976d2',
        isSelected: false,
        miniMapLabelX: 10,
        miniMapLabelY: 10,
      },
    ];

    render(
      <RoutePreviewHoverSnackbar
        matches={matches}
        isDarkMode={false}
        onToggleMatchSelection={onToggleMatchSelection}
        popupHint="hint"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select route 1' }));
    expect(onToggleMatchSelection).toHaveBeenCalledWith('r1');
  });

  it('calls onToggleMatchSelection when Enter key is pressed on row', () => {
    const onToggleMatchSelection = vi.fn();
    const matches: RoutePreviewHoverMatch[] = [
      {
        id: 'r1',
        index: 1,
        linePath: '0,0 10,10',
        summaryLine: 'Rail / A -> B',
        routeName: 'Route 1',
        distanceLabel: '100m',
        modeColor: '#1976d2',
        isSelected: false,
        miniMapLabelX: 10,
        miniMapLabelY: 10,
      },
    ];

    render(
      <RoutePreviewHoverSnackbar
        matches={matches}
        isDarkMode={false}
        onToggleMatchSelection={onToggleMatchSelection}
        popupHint="hint"
      />,
    );

    const row = screen.getByRole('button', { name: 'Select route 1' });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onToggleMatchSelection).toHaveBeenCalledWith('r1');
  });

  it('calls onToggleMatchSelection when space key is pressed on row', () => {
    const onToggleMatchSelection = vi.fn();
    const matches: RoutePreviewHoverMatch[] = [
      {
        id: 'r1',
        index: 1,
        linePath: '0,0 10,10',
        summaryLine: 'Rail / A -> B',
        routeName: 'Route 1',
        distanceLabel: '100m',
        modeColor: '#1976d2',
        isSelected: false,
        miniMapLabelX: 10,
        miniMapLabelY: 10,
      },
    ];

    render(
      <RoutePreviewHoverSnackbar
        matches={matches}
        isDarkMode={false}
        onToggleMatchSelection={onToggleMatchSelection}
        popupHint="hint"
      />,
    );

    const row = screen.getByRole('button', { name: 'Select route 1' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onToggleMatchSelection).toHaveBeenCalledWith('r1');
  });
});

