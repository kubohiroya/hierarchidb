import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ExtensibleFolderDialog } from '../components/ExtensibleFolderDialog';
import type { NodeId } from '@hierarchidb/common-type';
import type { DialogStepDefinition } from '@hierarchidb/common-type';

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
        />
      );

      expect(screen.getByLabelText(/Folder Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Create New Folder/i)).toBeInTheDocument();
    });

    it('should validate required name field', async () => {
      render(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={true}
        />
      );

      // Try to submit without entering name
      const submitButton = screen.getByRole('button', { name: /Complete/i });
      await userEvent.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Folder name is required/i)).toBeInTheDocument();
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
        />
      );

      // Enter folder-plugin name
      const nameInput = screen.getByLabelText(/Folder Name/i);
      await userEvent.type(nameInput, 'My New Folder');

      // Enter description
      const descInput = screen.getByLabelText(/Description/i);
      await userEvent.type(descInput, 'This is a test folder-plugin');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Complete/i });
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
        />
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
        />
      );

      // Change only the name
      const nameInput = screen.getByLabelText(/Folder Name/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Updated Folder');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Complete/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Updated Folder',
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
        />
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
        />
      );

      // Fill in basic info
      const nameInput = screen.getByLabelText(/Folder Name/i);
      await userEvent.type(nameInput, 'Extended Folder');

      // Go to next step
      const nextButton = screen.getByRole('button', { name: /Next/i });
      await userEvent.click(nextButton);

      // Fill in custom field
      const customInput = screen.getByLabelText(/Custom Field/i);
      await userEvent.type(customInput, 'Custom Value');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Complete/i });
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
        />
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
        />
      );

      expect(screen.getByRole('button', { name: /Complete/i })).toBeInTheDocument();
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
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
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
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close base-dialog
      rerender(
        <ExtensibleFolderDialog
          mode="create"
          parentId={'parent-123' as NodeId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          open={false}
        />
      );

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
