import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DynamicSpeedDial } from '../DynamicSpeedDial.js';
import type { TreeId } from '@hierarchidb/common-types';
import type { PluginMenuItem } from '~/hooks/usePluginMenuItems.js';
import "@testing-library/jest-dom";

const iconModule = vi.hoisted(() => ({
  getMuiIconWithColor: vi.fn(() => <div data-testid="speed-dial-icon" />),
}));

vi.mock('@hierarchidb/ui-icon', () => iconModule);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

const menuItemsModule = vi.hoisted(() => ({
  usePluginMenuItems: vi.fn((): PluginMenuItem[] => [
    {
      key: 'basemap',
      nodeType: 'basemap',
      label: 'Basemap',
      icon: {
        muiIconName: 'Public',
        emoji: '🗺️',
        color: '#123456',
      },
      group: 'base',
      priority: 10,
      description: 'Basemap',
      backgroundColor: '#12345622',
    },
  ]),
}));

vi.mock('~/hooks/usePluginMenuItems.js', () => menuItemsModule);

describe('DynamicSpeedDial', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
  });

  it('renders SpeedDial actions with manifest-provided icon metadata', () => {
    render(
      <DynamicSpeedDial
        treeId={'r' as TreeId}
        onCreateAction={vi.fn()}
      />,
    );

    const fab = document.body.querySelector('.MuiSpeedDial-fab') as HTMLElement | null;
    expect(fab).not.toBeNull();
    fireEvent.click(fab!);

    const action = screen.getByTestId('create-basemap-action');
    expect(action).toBeInTheDocument();
    expect(iconModule.getMuiIconWithColor).toHaveBeenCalledWith('Public', '🗺️', '#123456');
    expect(screen.getByTestId('speed-dial-icon')).toBeInTheDocument();
  });
});
