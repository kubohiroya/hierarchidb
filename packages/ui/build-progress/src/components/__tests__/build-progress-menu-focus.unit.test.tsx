import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hierarchidb/components', async () => {
  const React = await import('react');
  const mui = await import('@mui/material');
  const LoadingButton = React.forwardRef<HTMLButtonElement, ComponentProps<typeof mui.Button>>(
    function LoadingButtonMock(props, ref) {
      return <mui.Button ref={ref} {...props} />;
    }
  );
  const PillButton = React.forwardRef<HTMLButtonElement, ComponentProps<typeof mui.Button>>(
    function PillButtonMock(props, ref) {
      return <mui.Button ref={ref} {...props} />;
    }
  );
  return {
    LoadingButton,
    PillButton,
    PillButtonGroup: mui.ButtonGroup,
  };
});

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@hierarchidb/ui-lru-splitview', () => ({
  LRUSplitView2: ({
    panes,
    renderPane,
  }: {
    panes: Array<{ id: string }>;
    renderPane: (context: { id: string; toggle: () => void }) => ReactNode;
  }) => (
    <div>
      {panes.map((pane) => (
        <section key={pane.id}>{renderPane({ id: pane.id, toggle: () => {} })}</section>
      ))}
    </div>
  ),
}));

import { BuildControlCard } from '../BuildControlCard.js';
import { BuildStepPanel } from '../BuildStepPanel.js';
import { BuildStepStagePanel } from '../BuildStepStagePanel.js';

const noop = () => {};

describe('build-progress menu focus restoration', () => {
  it('returns focus to the reset/delete menu button after selecting an item', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <BuildControlCard
        status="idle"
        resetDeleteMenuAriaLabel="Reset or delete"
        resetDeleteMenuItems={[
          {
            id: 'reset',
            label: 'Reset build',
            onClick: onReset,
          },
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Reset or delete' });
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Reset build' })
    );

    expect(onReset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns focus to the stage menu button after selecting an item', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <BuildStepStagePanel
        title="Download"
        icon={<span aria-hidden="true">D</span>}
        progress={0}
        menuAriaLabel="Download stage menu"
        menuItems={[
          {
            id: 'export',
            label: 'Export log',
            onClick: onExport,
          },
        ]}
        failedMode={true}
        onFailedModeUpdate={noop}
        completedMode={true}
        onCompletedModeUpdate={noop}
        skippedMode={true}
        onSkippedModeUpdate={noop}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Download stage menu' });
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Export log' })
    );

    expect(onExport).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns focus to the build session menu button after selecting an item', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <BuildStepPanel
        status="idle"
        stages={[
          {
            id: 'download',
            title: 'Download',
            icon: <span aria-hidden="true">D</span>,
          },
        ]}
        controlMenuAriaLabel="Build session actions"
        controlMenuItems={[
          {
            id: 'settings',
            label: 'Settings',
            onClick: onOpenSettings,
          },
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Build session actions' });
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Settings' })
    );

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
