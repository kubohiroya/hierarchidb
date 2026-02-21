import '@testing-library/jest-dom';
/**
 * @file LinkButton.test.tsx
 * @description Comprehensive tests for LinkButton component and useLinkButton hook
 */

import { useNavigate } from '@tanstack/react-router';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkButton } from '../LinkButton';
import { useLinkButton } from '../useLinkButton';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
}));

// Mock toast provider is already handled in useLinkButton.ts

describe('LinkButton Component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as unknown as Mock).mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders with children', () => {
      render(<LinkButton>Click Me</LinkButton>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('shows loading text when loading', async () => {
      render(
        <LinkButton
          loadingText="Saving..."
          onSave={async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }}
        >
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });

    it('navigates to specified path', async () => {
      render(<LinkButton to="/next">Next</LinkButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/next',
          replace: false,
          state: undefined,
        });
      });
    });

    it('replaces history when replace prop is true', async () => {
      render(
        <LinkButton to="/next" replace>
          Next
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/next',
          replace: true,
          state: undefined,
        });
      });
    });
  });

  describe('Validation', () => {
    it('prevents action when validation fails', async () => {
      const onSave = vi.fn();
      const validate = vi.fn().mockResolvedValue(false);

      render(
        <LinkButton validate={validate} onSave={onSave}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(validate).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
      });
    });

    it('proceeds when validation passes', async () => {
      const onSave = vi.fn();
      const validate = vi.fn().mockResolvedValue(true);

      render(
        <LinkButton validate={validate} onSave={onSave}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(validate).toHaveBeenCalled();
        expect(onSave).toHaveBeenCalled();
      });
    });
  });

  describe('Confirmation Dialog', () => {
    it('shows confirmation base-dialog when configured', async () => {
      render(
        <LinkButton
          confirmDialog={{
            enabled: true,
            title: 'Confirm Delete',
            message: 'Are you sure?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
          }}
        >
          Delete
        </LinkButton>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'cancel-confirmation-base-dialog' })
        ).toBeInTheDocument();
      });
    });

    it('executes action on confirm', async () => {
      const onSave = vi.fn();

      render(
        <LinkButton
          confirmDialog={{
            enabled: true,
            message: 'Are you sure?',
          }}
          onSave={onSave}
        >
          Delete
        </LinkButton>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(button);

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'confirm-action' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('cancels action on cancel', async () => {
      const onSave = vi.fn();

      render(
        <LinkButton
          confirmDialog={{
            enabled: true,
            message: 'Are you sure?',
          }}
          onSave={onSave}
        >
          Delete
        </LinkButton>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(button);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', {
          name: 'cancel-confirmation-base-dialog',
        });
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('Multi-Step Workflow', () => {
    it('executes steps in order', async () => {
      const step1 = vi.fn();
      const step2 = vi.fn();

      render(<LinkButton steps={[{ execute: step1 }, { execute: step2 }]}>Execute</LinkButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(step1).toHaveBeenCalled();
        expect(step2).toHaveBeenCalled();
        const step1Order = step1.mock.invocationCallOrder[0];
        const step2Order = step2.mock.invocationCallOrder[0];
        expect(step1Order).toBeDefined();
        expect(step2Order).toBeDefined();
        if (step1Order !== undefined && step2Order !== undefined) {
          expect(step1Order).toBeLessThan(step2Order);
        }
      });
    });

    it('stops execution if step validation fails', async () => {
      const step1Execute = vi.fn();
      const step2Execute = vi.fn();

      render(
        <LinkButton
          steps={[
            {
              validate: () => false,
              execute: step1Execute,
            },
            { execute: step2Execute },
          ]}
        >
          Execute
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(step1Execute).not.toHaveBeenCalled();
        expect(step2Execute).not.toHaveBeenCalled();
      });
    });

    it('handles step errors with onError callback', async () => {
      const stepError = new Error('Step failed');
      const stepOnError = vi.fn();
      const globalOnError = vi.fn();

      render(
        <LinkButton
          steps={[
            {
              execute: async () => {
                throw stepError;
              },
              onError: stepOnError,
            },
          ]}
          onError={globalOnError}
        >
          Execute
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(stepOnError).toHaveBeenCalledWith(stepError);
        expect(globalOnError).toHaveBeenCalledWith(stepError);
      });
    });
  });

  describe('Save and Cleanup', () => {
    it('executes save operation', async () => {
      const onSave = vi.fn();

      render(<LinkButton onSave={onSave}>Save</LinkButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('executes cleanup after save', async () => {
      const onSave = vi.fn();
      const onCleanup = vi.fn();

      render(
        <LinkButton onSave={onSave} onCleanup={onCleanup}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(onCleanup).toHaveBeenCalled();
        const onSaveOrder = onSave.mock.invocationCallOrder[0];
        const onCleanupOrder = onCleanup.mock.invocationCallOrder[0];
        expect(onSaveOrder).toBeDefined();
        expect(onCleanupOrder).toBeDefined();
        if (onSaveOrder !== undefined && onCleanupOrder !== undefined) {
          expect(onSaveOrder).toBeLessThan(onCleanupOrder);
        }
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onBeforeAction and respects result', async () => {
      const onBeforeAction = vi.fn().mockResolvedValue(false);
      const onSave = vi.fn();

      render(
        <LinkButton onBeforeAction={onBeforeAction} onSave={onSave}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onBeforeAction).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
      });
    });

    it('calls onSuccess after successful execution', async () => {
      const onSave = vi.fn();
      const onSuccess = vi.fn();

      render(
        <LinkButton onSave={onSave} onSuccess={onSuccess}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('calls onError on failure', async () => {
      const error = new Error('Save failed');
      const onSave = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      render(
        <LinkButton onSave={onSave} onError={onError}>
          Save
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Double-Click Prevention', () => {
    it('prevents double-click by default', async () => {
      const onSave = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(<LinkButton onSave={onSave}>Save</LinkButton>);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Legacy Props Support', () => {
    it('supports onBeforeNavigate', async () => {
      const onBeforeNavigate = vi.fn().mockResolvedValue(true);

      render(
        <LinkButton to="/next" onBeforeNavigate={onBeforeNavigate}>
          Next
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onBeforeNavigate).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/next',
          replace: false,
          state: undefined,
        });
      });
    });

    it('supports onSuccessNavigate', async () => {
      const onSuccessNavigate = vi.fn();

      render(
        <LinkButton to="/next" onSuccessNavigate={onSuccessNavigate}>
          Next
        </LinkButton>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSuccessNavigate).toHaveBeenCalled();
      });
    });
  });
});

describe('useLinkButton Hook', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as unknown as Mock).mockReturnValue(mockNavigate);
  });

  it('returns expected interface', () => {
    const { result } = renderHook(() => useLinkButton({ to: '/next' }));

    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('confirmOpen');
    expect(result.current).toHaveProperty('handleClick');
    expect(result.current).toHaveProperty('handleConfirm');
    expect(result.current).toHaveProperty('handleCancel');
    expect(result.current).toHaveProperty('executeAction');
    expect(result.current).toHaveProperty('setConfirmOpen');
  });

  it('manages loading atoms correctly', async () => {
    const onSave = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const { result } = renderHook(() => useLinkButton({ onSave }));

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.loading).toBe(false);
    expect(onSave).toHaveBeenCalled();
  });

  it('handles complex workflow', async () => {
    const step1 = vi.fn();
    const step2 = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useLinkButton({
        to: '/success',
        steps: [{ execute: step1 }, { execute: step2 }],
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.executeAction();
    });

    expect(step1).toHaveBeenCalled();
    expect(step2).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/success',
      replace: false,
      state: undefined,
    });
  });

  it('handles errors correctly', async () => {
    const error = new Error('Test error');
    const onSave = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { result } = renderHook(() => useLinkButton({ onSave, onError }));

    await act(async () => {
      await result.current.executeAction();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });
});
