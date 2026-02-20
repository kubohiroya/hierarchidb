/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import { PluginDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, vi } from 'vitest';
import { PluginDialogHeader } from '../components/PluginDialogHeader';
import '@testing-library/jest-dom/vitest';

const headerLocationRef = {
  pathname: '/dialog',
  searchStr: '',
  hash: '',
};

type MockLinkProps = ComponentProps<'a'> & {
  to?: string | { to?: string };
};

vi.mock('@tanstack/react-router', () => {
  const React = require('react') as typeof import('react');
  return {
    useNavigate: () => () => Promise.resolve(),
    useLocation: () => headerLocationRef,
    Link: React.forwardRef<HTMLAnchorElement, MockLinkProps>(({ to, children, ...rest }, ref) => {
      const href = typeof to === 'string' ? to : (to?.to ?? '#');
      return React.createElement('a', { ref, href, ...rest }, children);
    }),
  };
});

afterEach(() => {
  cleanup();
});

describe('PluginDialogHeader', () => {
  it('uses MUI buttons and triggers navigation callbacks', () => {
    const onStepNavigate = vi.fn();
    const onRequestClose = vi.fn();
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'basic', label: 'Basic', component: () => null },
        { id: 'details', label: 'Details', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 0,
      enabledStepIndices: [0, 1],
      validatedStepIndices: [],
      committableStepIndices: [1],
      invalidMessageMap: {},
      isDirty: true,
      onStepNavigate,
      onRequestClose,
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown: vi.fn(),
    };

    headerLocationRef.pathname = '/dialog';
    headerLocationRef.searchStr = '';
    headerLocationRef.hash = '';

    const { container } = render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" mode="create" />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    const detailsStepButton = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsStepButton);
    expect(onStepNavigate).toHaveBeenCalledWith({ type: 'direct', targetIndex: 1 });

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    const closeButton = screen.getByLabelText('Close dialog');
    expect(closeButton).toHaveClass('MuiIconButton-sizeLarge');
    const headerRoot = container.querySelector('[data-dialog-drag-handle="true"]');
    expect(headerRoot?.querySelector('button')).toBe(closeButton);
    fireEvent.click(closeButton);
    expect(onRequestClose).toHaveBeenCalledWith('close');
  });

  it('treats the entire header container as the drag handle', () => {
    const onDragHandlePointerDown = vi.fn();
    const contextValue = {
      open: true,
      stepComponents: [{ id: 'basic', label: 'Basic', component: () => null }],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 0,
      enabledStepIndices: [0],
      validatedStepIndices: [],
      committableStepIndices: [],
      invalidMessageMap: {},
      isDirty: false,
      onStepNavigate: vi.fn(),
      onRequestClose: vi.fn(),
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown,
    };

    const { container } = render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    const dragHandle = container.querySelector(
      '[data-dialog-drag-handle="true"]'
    ) as HTMLElement | null;
    expect(dragHandle).not.toBeNull();
    fireEvent.pointerDown(dragHandle!, { button: 0 });
    expect(onDragHandlePointerDown).toHaveBeenCalledTimes(1);
  });

  it('distinguishes validated steps from the active step and exposes aria hints', () => {
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'basic', label: 'Step One', component: () => null },
        { id: 'details', label: 'Step Two', component: () => null },
        { id: 'review', label: 'Step Three', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 1,
      enabledStepIndices: [0, 1, 2],
      validatedStepIndices: [0],
      committableStepIndices: [2],
      invalidMessageMap: {},
      isDirty: true,
      onStepNavigate: vi.fn(),
      onRequestClose: vi.fn(),
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown: vi.fn(),
    } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    const validatedIcon = screen.getByTestId('plugin-dialog-step-icon-1');
    expect(validatedIcon.getAttribute('data-validated')).toBe('true');
    expect(validatedIcon.getAttribute('data-active')).toBe('false');

    const activeIcon = screen.getByTestId('plugin-dialog-step-icon-2');
    expect(activeIcon.getAttribute('data-active')).toBe('true');
    expect(activeIcon.getAttribute('data-validated')).toBe('false');

    expect(screen.queryByText('Current step')).toBeNull();

    const activeLabel = screen.getByText('2. Step Two');
    expect(activeLabel.getAttribute('data-active-label')).toBe('true');
    const inactiveLabel = screen.getByText('1. Step One');
    expect(inactiveLabel.getAttribute('data-active-label')).toBe('false');

    const activeStepButton = screen.getByRole('button', { name: /Step Two/i });
    expect(activeStepButton.getAttribute('aria-current')).toBe('step');
  });

  it('shows a grey validated icon when the step is valid but disabled due to a previous invalid step', () => {
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'basic', label: 'Step One', component: () => null },
        { id: 'details', label: 'Step Two', component: () => null },
        { id: 'review', label: 'Step Three', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 0,
      enabledStepIndices: [0],
      validatedStepIndices: [1],
      committableStepIndices: [2],
      invalidMessageMap: {},
      isDirty: true,
      onStepNavigate: vi.fn(),
      onRequestClose: vi.fn(),
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown: vi.fn(),
    } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Edit Item" />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    const validatedDisabledIcon = screen.getByTestId('plugin-dialog-step-icon-2');
    expect(validatedDisabledIcon.getAttribute('data-validated')).toBe('true');
    expect(validatedDisabledIcon.getAttribute('data-active')).toBe('false');

    const disabledStep = screen.getByRole('button', { name: /Step Two/i });
    expect(disabledStep).toBeDisabled();
  });

  it('resolves mapped icons by step id regardless of localized labels', () => {
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'data-source', label: 'データソース', component: () => null },
        { id: 'map-style', label: '地図スタイル', component: () => null },
        { id: 'country-selection', label: '国選択', component: () => null },
        { id: 'build', label: 'ビルド', component: () => null },
        { id: 'preview', label: 'プレビュー', component: () => null },
        { id: 'unmapped-step', label: '未定義', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 0,
      enabledStepIndices: [0, 1, 2, 3, 4, 5],
      validatedStepIndices: [],
      committableStepIndices: [],
      invalidMessageMap: {},
      isDirty: false,
      onStepNavigate: vi.fn(),
      onRequestClose: vi.fn(),
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown: vi.fn(),
    } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Edit Item" />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    expect(within(screen.getByTestId('plugin-dialog-step-icon-1')).getByTestId('CloudDownloadIcon')).toBeInTheDocument();
    expect(within(screen.getByTestId('plugin-dialog-step-icon-2')).getByTestId('PaletteIcon')).toBeInTheDocument();
    expect(within(screen.getByTestId('plugin-dialog-step-icon-3')).getByTestId('PublicIcon')).toBeInTheDocument();
    expect(within(screen.getByTestId('plugin-dialog-step-icon-4')).getByTestId('ConstructionIcon')).toBeInTheDocument();
    expect(within(screen.getByTestId('plugin-dialog-step-icon-5')).getByTestId('VisibilityIcon')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-dialog-step-icon-6')).toHaveTextContent('6');
  });

  it('keeps Construction icon visible for build step while in progress', () => {
    const contextValue = {
      open: true,
      stepComponents: [
        { id: 'data-source', label: 'Data Source', component: () => null },
        { id: 'build', label: 'Build', component: () => null },
      ],
      stepData: {},
      onStepDataChange: vi.fn(),
      activeStepIndex: 1,
      enabledStepIndices: [0, 1],
      validatedStepIndices: [],
      committableStepIndices: [],
      invalidMessageMap: {},
      isDirty: false,
      onStepNavigate: vi.fn(),
      onRequestClose: vi.fn(),
      onRequestCommit: vi.fn(),
      displayMode: 'normal' as const,
      onDisplayModeChange: vi.fn(),
      onDragHandlePointerDown: vi.fn(),
    } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <PluginDialogProvider value={contextValue}>
          <PluginDialogHeader title="Edit Item" buildStepRunning />
        </PluginDialogProvider>
      </ThemeProvider>
    );

    const buildIconContainer = screen.getByTestId('plugin-dialog-step-icon-2');
    expect(buildIconContainer.getAttribute('data-in-progress')).toBe('true');
    expect(within(buildIconContainer).getByTestId('ConstructionIcon')).toBeInTheDocument();
  });
});
