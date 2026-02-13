import type { TreeId } from '@hierarchidb/core-types';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginMenuItem } from '~/hooks/usePluginMenuItems.js';
import { DynamicSpeedDial } from '../DynamicSpeedDial.js';
import '@testing-library/jest-dom';

const iconModule = vi.hoisted(() => {
  const resolveIcon = vi.fn(() => <div data-testid="speed-dial-icon" />);
  return {
    useIconRegistry: vi.fn(() => ({
      resolveIcon,
      ready: true,
      error: null,
    })),
    __mocks: { resolveIcon },
  };
});

vi.mock('@hierarchidb/ui-icon', () => iconModule);

vi.mock('@hierarchidb/ui-plugin-shell/ui-i18n', () => ({
  useGlobalI18nTranslator: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    language: 'en',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

const menuItemsModule = vi.hoisted(() => ({
  usePluginMenuItems: vi.fn<() => PluginMenuItem[]>(),
}));

vi.mock('~/hooks/usePluginMenuItems.js', () => menuItemsModule);

describe('DynamicSpeedDial', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.clearAllMocks();
    menuItemsModule.usePluginMenuItems.mockReturnValue([
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
    ]);
  });

  it('renders SpeedDial actions with manifest-provided icon metadata', () => {
    render(<DynamicSpeedDial treeId={'r' as TreeId} onCreateAction={vi.fn()} />);

    const fab = document.body.querySelector('.MuiSpeedDial-fab') as HTMLElement | null;
    expect(fab).not.toBeNull();
    if (!fab) {
      throw new Error('SpeedDial fab not found');
    }
    fireEvent.click(fab);

    const action = screen.getByTestId('create-basemap-action');
    expect(action).toBeInTheDocument();
    expect(iconModule.__mocks.resolveIcon).toHaveBeenCalledWith({
      nodeType: 'basemap',
      icon: {
        muiIconName: 'Public',
        emoji: '🗺️',
        color: '#123456',
      },
    });
    expect(screen.getByTestId('speed-dial-icon')).toBeInTheDocument();
  });

  it('opens right-to-left submenu on hover and triggers child action click', () => {
    menuItemsModule.usePluginMenuItems.mockReturnValue([
      {
        key: 'shape',
        nodeType: 'shape',
        label: 'Shape',
        icon: {
          muiIconName: 'Polyline',
          emoji: '🟦',
          color: '#334455',
        },
        priority: 10,
        description: 'Shape data',
        backgroundColor: '#33445522',
        children: [
          {
            key: 'shape-preset-japan-level0-1',
            nodeType: 'shape',
            createType: 'shape::preset:japan-level0-1',
            label: 'Japan level0+1 (prefectures)',
            description: 'Select Japan only. Include admin level 0 and level 1 boundaries.',
            icon: {
              muiIconName: 'Polyline',
              emoji: '🟦',
              color: '#334455',
            },
            priority: 11,
            backgroundColor: '#33445522',
          },
          {
            key: 'shape-preset-world-level0',
            nodeType: 'shape',
            createType: 'shape::preset:world-level0',
            label: 'World countries level0',
            description: 'Select all countries at admin level 0 for compact global coverage.',
            icon: {
              muiIconName: 'Polyline',
              emoji: '🟦',
              color: '#334455',
            },
            priority: 12,
            backgroundColor: '#33445522',
          },
        ],
      },
    ]);

    const onCreateAction = vi.fn();
    render(<DynamicSpeedDial treeId={'r' as TreeId} onCreateAction={onCreateAction} />);

    const fab = document.body.querySelector('.MuiSpeedDial-fab') as HTMLElement | null;
    expect(fab).not.toBeNull();
    if (!fab) {
      throw new Error('SpeedDial fab not found');
    }
    fireEvent.click(fab);

    const shapeAction = screen.getByTestId('create-shape-action');
    fireEvent.mouseEnter(shapeAction);

    const submenu = screen.getByTestId('create-shape-submenu');
    expect(submenu).toBeInTheDocument();
    const popperRoot = submenu.closest('[data-popper-placement]');
    expect(popperRoot?.getAttribute('data-popper-placement')).toBe('left-start');

    fireEvent.click(screen.getByTestId('create-shape-submenu-action-2'));
    expect(onCreateAction).toHaveBeenCalledWith(
      'create:shape::preset:world-level0',
      expect.any(Object),
      expect.objectContaining({ openInNewTab: false })
    );
  });
});
