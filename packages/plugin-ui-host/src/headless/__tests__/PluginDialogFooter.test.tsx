/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom/vitest" />
import '@testing-library/jest-dom/vitest';
import { PluginDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import { PluginDialogFooter } from '../components/PluginDialogFooter';

type ContextOverrides = Partial<Parameters<typeof PluginDialogProvider>[0]['value']>;

const footerLocationRef = {
  pathname: '/d/r/page-node/target-node/shape/edit/normal/1',
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

beforeEach(() => {
  vi.restoreAllMocks();
  footerLocationRef.pathname = '/d/r/page-node/target-node/shape/edit/normal/1';
  footerLocationRef.searchStr = '';
  footerLocationRef.hash = '';
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

describe('PluginDialogFooter step link context menu', () => {
  it('opens context menu on Next right click and opens URL in new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithContext(<PluginDialogFooter mode="create" canCommit={false} />, {
      activeStepIndex: 0,
      enabledStepIndices: [0, 1],
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    fireEvent.contextMenu(nextButton, { clientX: 100, clientY: 120 });

    const openInNewTab = screen.getByRole('menuitem', { name: 'Open In New Tab' });
    fireEvent.click(openInNewTab);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toMatch('/d/r/page-node/target-node/shape/edit/normal/2');
  });

  it('opens URL in new window from context menu', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithContext(<PluginDialogFooter mode="create" canCommit={false} />, {
      activeStepIndex: 0,
      enabledStepIndices: [0, 1],
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    fireEvent.contextMenu(nextButton, { clientX: 100, clientY: 120 });

    const openInNewWindow = screen.getByRole('menuitem', { name: 'Open In New Window' });
    fireEvent.click(openInNewWindow);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toMatch('/d/r/page-node/target-node/shape/edit/normal/2');
    expect(openSpy.mock.calls[0]?.[2]).toContain('popup=yes');
  });

  it('copies URL from context menu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithContext(<PluginDialogFooter mode="create" canCommit={false} />, {
      activeStepIndex: 1,
      enabledStepIndices: [0, 1, 2],
      stepComponents: [
        { id: 'basic', label: 'Basic', component: () => null },
        { id: 'details', label: 'Details', component: () => null },
        { id: 'summary', label: 'Summary', component: () => null },
      ],
    });

    const backButton = screen.getByRole('button', { name: 'Back' });
    fireEvent.contextMenu(backButton, { clientX: 100, clientY: 120 });

    const copyLinkUrl = screen.getByRole('menuitem', { name: 'Copy Link URL' });
    fireEvent.click(copyLinkUrl);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toMatch('/d/r/page-node/target-node/shape/edit/normal/1');
  });
});
