/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom/vitest';
import { PluginDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, vi } from 'vitest';
import { PluginDialogFooter } from '../components/PluginDialogFooter';

type ContextOverrides = Partial<Parameters<typeof PluginDialogProvider>[0]['value']>;

const footerLocationRef = {
  pathname: '/t/r/some-node',
  searchStr: '',
  hash: '',
};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => footerLocationRef,
}));

afterEach(() => {
  cleanup();
});

function renderWithContext(ui: ReactNode, overrides: ContextOverrides) {
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
    onStepNavigate: vi.fn(),
    onRequestClose: vi.fn(),
    onRequestCommit: vi.fn(),
    displayMode: 'normal' as const,
    onDisplayModeChange: vi.fn(),
    onDragHandlePointerDown: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof PluginDialogProvider>[0]['value'];

  return render(
    <ThemeProvider theme={createTheme()}>
      <PluginDialogProvider value={contextValue}>{ui}</PluginDialogProvider>
    </ThemeProvider>
  );
}

describe('PluginDialogFooter icons', () => {
  it('shows Close and Next icons on the first step', () => {
    renderWithContext(<PluginDialogFooter mode="create" canCommit={false} />, {
      activeStepIndex: 0,
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(within(cancelButton).queryByTestId('CloseIcon')).not.toBeNull();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(within(nextButton).queryByTestId('ChevronRightIcon')).not.toBeNull();
  });

  it('shows Back and Save icons on the final step (create mode)', () => {
    renderWithContext(<PluginDialogFooter mode="create" canCommit={true} />, {
      activeStepIndex: 1,
    });

    const backButton = screen.getByRole('button', { name: 'Back' });
    expect(within(backButton).queryByTestId('ChevronLeftIcon')).not.toBeNull();

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(within(saveButton).queryByTestId('CheckIcon')).not.toBeNull();
  });

  it('shows the check icon for Save (edit mode) on the final step', () => {
    renderWithContext(<PluginDialogFooter mode="edit" canCommit={true} />, { activeStepIndex: 1 });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(within(saveButton).queryByTestId('CheckIcon')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Save' }).length).toBe(1);
  });
});

describe('PluginDialogFooter layout', () => {
  it('reserves the center slot for the Build button', () => {
    renderWithContext(
      <PluginDialogFooter mode="edit" canCommit={true} onStartBuild={() => void 0} />,
      {
        activeStepIndex: 0,
        validatedStepIndices: [0, 1],
      }
    );

    const centerSlot = screen.getByTestId('plugin-dialog-footer-center');
    expect(within(centerSlot).queryByRole('button', { name: 'Build' })).not.toBeNull();
  });
});
