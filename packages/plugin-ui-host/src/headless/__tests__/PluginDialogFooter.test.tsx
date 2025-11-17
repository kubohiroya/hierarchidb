import { MultiStepDialogProvider } from '@hierarchidb/ui-dialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { PluginDialogFooter } from '../components/PluginDialogFooter.js';

type ContextOverrides = Partial<Parameters<typeof MultiStepDialogProvider>[0]['value']>;

const footerLocationRef = {
  pathname: '/t/r/some-node',
  searchStr: '',
  hash: '',
};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => Promise.resolve(),
  useLocation: () => footerLocationRef,
}));

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
  } satisfies Parameters<typeof MultiStepDialogProvider>[0]['value'];

  return render(
    <ThemeProvider theme={createTheme()}>
      <MultiStepDialogProvider value={contextValue}>{ui}</MultiStepDialogProvider>
    </ThemeProvider>
  );
}

describe('PluginDialogFooter icons', () => {
  it('shows Close and Next icons on the first step', () => {
    renderWithContext(
      <PluginDialogFooter mode="create" canCommit={false} />, 
      { activeStepIndex: 0 }
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(within(cancelButton).getByTestId('CloseIcon')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(within(nextButton).getByTestId('ChevronRightIcon')).toBeInTheDocument();
  });

  it('shows Back and Create icons on the final step (create mode)', () => {
    renderWithContext(
      <PluginDialogFooter mode="create" canCommit={true} />, 
      { activeStepIndex: 1 }
    );

    const backButton = screen.getByRole('button', { name: 'Back' });
    expect(within(backButton).getByTestId('ChevronLeftIcon')).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(within(createButton).getByTestId('CheckIcon')).toBeInTheDocument();
  });

  it('shows the check icon for Save (edit mode) on the final step', () => {
    renderWithContext(
      <PluginDialogFooter mode="edit" canCommit={true} />, 
      { activeStepIndex: 1 }
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(within(saveButton).getByTestId('CheckIcon')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save' }).length).toBe(1);
  });
});

describe('PluginDialogFooter inline save button', () => {
  it('renders a disabled Save button on edit mode before validations finish', () => {
    renderWithContext(<PluginDialogFooter mode="edit" canCommit={true} />, {
      activeStepIndex: 0,
      validatedStepIndices: [0],
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('enables the Save button once all steps are validated', () => {
    renderWithContext(<PluginDialogFooter mode="edit" canCommit={true} />, {
      activeStepIndex: 0,
      validatedStepIndices: [0, 1],
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();
  });
});

describe('PluginDialogFooter layout', () => {
  it('reserves the center slot for the Start Batch button', () => {
    renderWithContext(
      <PluginDialogFooter mode="edit" canCommit={true} onStartBatch={() => void 0} />,
      {
        activeStepIndex: 0,
        validatedStepIndices: [0, 1],
      }
    );

    const centerSlot = screen.getByTestId('plugin-dialog-footer-center');
    expect(within(centerSlot).getByRole('button', { name: 'Start Batch' })).toBeInTheDocument();
  });
});
