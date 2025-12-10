/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import { MultiStepDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { PluginDialogHeader } from '../components/PluginDialogHeader.js';
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

    render(
      <ThemeProvider theme={createTheme()}>
        <MultiStepDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" mode="create" />
        </MultiStepDialogProvider>
      </ThemeProvider>
    );

    const detailsStepButton = screen.getByRole('link', { name: /Details/i });
    fireEvent.click(detailsStepButton);
    expect(onStepNavigate).toHaveBeenCalledWith({ type: 'direct', targetIndex: 1 });

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    const closeButton = screen.getByLabelText('Close dialog');
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
        <MultiStepDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" />
        </MultiStepDialogProvider>
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
    } satisfies Parameters<typeof MultiStepDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <MultiStepDialogProvider value={contextValue}>
          <PluginDialogHeader title="Create Folder" />
        </MultiStepDialogProvider>
      </ThemeProvider>
    );

    const validatedIcon = screen.getByTestId('plugin-dialog-step-icon-1');
    expect(validatedIcon.getAttribute('data-validated')).toBe('true');
    expect(validatedIcon.getAttribute('data-active')).toBe('false');

    const activeIcon = screen.getByTestId('plugin-dialog-step-icon-2');
    expect(activeIcon.getAttribute('data-active')).toBe('true');
    expect(activeIcon.getAttribute('data-validated')).toBe('false');

    expect(screen.queryByText('Current step')).toBeNull();

    const activeLabel = screen.getByText('Step Two');
    expect(activeLabel.getAttribute('data-active-label')).toBe('true');
    const inactiveLabel = screen.getByText('Step One');
    expect(inactiveLabel.getAttribute('data-active-label')).toBe('false');

    const activeStepButton = screen.getByRole('link', { name: /Step Two/i });
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
    } satisfies Parameters<typeof MultiStepDialogProvider>[0]['value'];

    render(
      <ThemeProvider theme={createTheme()}>
        <MultiStepDialogProvider value={contextValue}>
          <PluginDialogHeader title="Edit Item" />
        </MultiStepDialogProvider>
      </ThemeProvider>
    );

    const validatedDisabledIcon = screen.getByTestId('plugin-dialog-step-icon-2');
    expect(validatedDisabledIcon.getAttribute('data-validated')).toBe('true');
    expect(validatedDisabledIcon.getAttribute('data-valid-disabled')).toBe('true');
    expect(validatedDisabledIcon.getAttribute('data-active')).toBe('false');

    const disabledStep = screen.getByRole('link', { name: /Step Two/i });
    expect(disabledStep.getAttribute('aria-disabled')).toBe('true');
  });
});
