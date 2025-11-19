import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { ExtensibleFolderDialog } from '~/ui/components/ExtensibleFolderDialog.js';
import type { DialogStepDefinition, NodeId } from '@hierarchidb/common-types';
import type { ExtensibleFolderDialogProps } from '~/ui/components/ExtensibleFolderDialog.js';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { getDialogSurfaceColor } from '@hierarchidb/ui-dialog';

describe('ExtensibleFolderDialog', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render basic folder-plugin fields in create mode', () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      expect(screen.getByLabelText(/Folder Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Create New Folder/i)).toBeInTheDocument();
    });

    it('should validate required name field', async () => {
      const guardStep: DialogStepDefinition = {
        stepNumber: 2,
        title: 'Guard',
        component: () => <div>Guard Step</div>,
      };
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
          additionalSteps={[guardStep]}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /Next/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        const helperId = screen.getByLabelText(/Folder Name/i).getAttribute('aria-describedby');
        const helper = helperId ? document.getElementById(helperId) : null;
        expect(helper?.textContent).toContain('Folder name is required');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit valid data in create mode', async () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      // Enter folder-plugin name
      const nameInput = screen.getByLabelText(/Folder Name/i);
      fireEvent.change(nameInput, { target: { value: 'My New Folder' } });

      const descInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descInput, { target: { value: 'This is a test folder-plugin' } });

      // Submit
      const [submitButton] = screen.getAllByRole('button', { name: /Complete/i, hidden: true });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'My New Folder',
          description: 'This is a test folder-plugin',
        });
      });
    });
  });

  describe('Edit Mode', () => {
    const currentData = {
      id: 'entity-123' as any,
      name: 'Existing Folder',
      description: 'Existing description',
      hasChildren: false,
      childCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should render with current data in edit mode', () => {
      render(
        <ExtensibleFolderDialog
          mode="edit"
          nodeId={'node-456' as NodeId}
          currentData={currentData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      expect(screen.getByDisplayValue('Existing Folder')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
      expect(screen.getByText(/Edit Folder/i)).toBeInTheDocument();
    });

    it('should only submit changed fields in edit mode', async () => {
      render(
        <ExtensibleFolderDialog
          mode="edit"
          nodeId={'node-456' as NodeId}
          currentData={currentData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      // Change only the name
      const nameInput = screen.getByLabelText(/Folder Name/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Folder');

      // Submit
      const [submitButton] = screen.getAllByRole('button', { name: /Complete/i, hidden: true });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Updated Folder',
          description: '',
        });
      });
    });
  });

  describe('Extension Support', () => {
    // Mock additional step component
    const AdditionalStep: React.FC<{
      data: any;
      onChange: (data: any) => void;
    }> = ({ data, onChange }) => (
      <div>
        <label>
          Custom Field:
          <input
            value={data.customField || ''}
            onChange={(e) => onChange({ ...data, customField: e.target.value })}
          />
        </label>
      </div>
    );

    const additionalStep: DialogStepDefinition = {
      stepNumber: 2,
      title: 'Custom Settings',
      component: AdditionalStep,
    };

    it('should render additional steps from extensions', () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
          additionalSteps={[additionalStep]}
        />,
      );

      // Should show stepper with multiple steps
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Custom Settings')).toBeInTheDocument();
    });

    it('should include extension data in submission', async () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
          additionalSteps={[additionalStep]}
        />,
      );

      // Fill in basic info
      const nameInput = screen.getByLabelText(/Folder Name/i);
      await userEvent.type(nameInput, 'Extended Folder');

      // Go to next step
      const [nextButton] = screen.getAllByRole('button', { name: /Next/i, hidden: true });
      await userEvent.click(nextButton);

      // Fill in custom field
      const customInput = screen.getByLabelText(/Custom Field/i);
      await userEvent.type(customInput, 'Custom Value');

      // Submit
      const [submitButton] = screen.getAllByRole('button', { name: /Complete/i, hidden: true });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Extended Folder',
          description: undefined,
          customField: 'Custom Value',
        });
      });
    });
  });

  describe('Custom Props', () => {
    it('should use custom title', () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
          title="Create Special Folder"
        />,
      );

      expect(screen.getByText('Create Special Folder')).toBeInTheDocument();
    });

    it('should show complete button in edit mode', () => {
      render(
        <ExtensibleFolderDialog
          mode="edit"
          nodeId={'node-456' as NodeId}
          currentData={{
            id: 'entity-456' as any,
            name: 'Test',
            description: '',
            hasChildren: false,
            childCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      expect(screen.getAllByRole('button', { name: /Complete/i, hidden: true }).length).toBeGreaterThan(0);
    });
  });

  describe('Dialog Actions', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      const [cancelButton] = screen.getAllByRole('button', { name: /Cancel/i, hidden: true });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should handle base-dialog close', async () => {
      const { rerender } = render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />,
      );

      expect(document.querySelector('[role="dialog"]')).not.toBeNull();

      // Close base-dialog
      rerender(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={false}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme integration', () => {
    const renderWithTheme = (theme: Theme, options: Partial<Pick<ExtensibleFolderDialogProps, 'additionalSteps'>> = {}) =>
      render(
        <ThemeProvider theme={theme}>
          <ExtensibleFolderDialog
            mode="create"
            parentId={'parent-theme' as NodeId}
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
            open={true}
            additionalSteps={options.additionalSteps ?? []}
          />
        </ThemeProvider>,
      );

    const resolveCssColor = (color: string) => {
      const probe = document.createElement('div');
      probe.style.color = color;
      document.body.appendChild(probe);
      const resolved = window.getComputedStyle(probe).color;
      document.body.removeChild(probe);
      return resolved;
    };

    it.each([
      ['light', createTheme({ palette: { mode: 'light' } })],
      ['dark', createTheme({ palette: { mode: 'dark' } })],
    ])('applies themed dialog surface in %s mode', (_, theme) => {
      renderWithTheme(theme);
      const dialog = screen.getByRole('dialog');
      const background = window.getComputedStyle(dialog).backgroundColor;
      const expected = resolveCssColor(getDialogSurfaceColor(theme));
      expect(background).toBe(expected);
    });

    it('uses primary palette tokens for active step indicator', () => {
      const theme = createTheme({ palette: { mode: 'light', primary: { main: '#3949ab' } } });
      renderWithTheme(theme);
      const [activeStep] = screen.getAllByRole('listitem');
      const computed = window.getComputedStyle(activeStep);
      expect(computed.backgroundColor).toBe(resolveCssColor(theme.palette.primary.main));
      expect(computed.color).toBe(resolveCssColor(theme.palette.primary.contrastText));
    });

    it('renders validation feedback using theme error color', async () => {
      const theme = createTheme({ palette: { mode: 'dark', error: { main: '#ff7043' } } });
      const guardStep: DialogStepDefinition = {
        stepNumber: 2,
        title: 'Guard',
        component: () => <div>Guard Step</div>,
      };
      renderWithTheme(theme, { additionalSteps: [guardStep] });

      const nextButton = screen.getByRole('button', { name: /Next/i });
      await userEvent.click(nextButton);

      const errorCandidates = await screen.findAllByText(/Folder name is required/i);
      const summaryNode = errorCandidates.find((node) => !(node as HTMLElement).id);
      expect(summaryNode).toBeDefined();
      const errorContainer = (summaryNode as HTMLElement).parentElement as HTMLElement;
      const computed = window.getComputedStyle(errorContainer);
      expect(computed.color).toBe(resolveCssColor(theme.palette.error.main));
    });
  });
});
