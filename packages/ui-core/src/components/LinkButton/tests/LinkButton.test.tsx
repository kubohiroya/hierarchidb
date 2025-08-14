/**
 * @file LinkButton.test.tsx
 * @description Comprehensive tests for LinkButton component and useLinkButton hook
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { LinkButton } from '../LinkButton';
import { useLinkButton } from '../useLinkButton';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock toast provider
vi.mock('@/shared/components/toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

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
      render(
        <BrowserRouter>
          <LinkButton>Click Me</LinkButton>
        </BrowserRouter>
      );
      expect(screen.getByText('Click Me')).toBeTruthy();
    });

    it('shows loading text when loading', async () => {
      render(
        <BrowserRouter>
          <LinkButton
            loadingText="Saving..."
            onSave={async () => {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }}
          >
            Save
          </LinkButton>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });
    });

    it('navigates to specified path', async () => {
      render(
        <BrowserRouter>
          <LinkButton to="/next">Next</LinkButton>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/next', {
          replace: false,
          state: undefined,
        });
      });
    });

    it('replaces history when replace prop is true', async () => {
      render(
        <BrowserRouter>
          <LinkButton to="/next" replace>
            Next
          </LinkButton>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/next', {
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
        <BrowserRouter>
          <LinkButton validate={validate} onSave={onSave}>
            Save
          </LinkButton>
        </BrowserRouter>
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
        <BrowserRouter>
          <LinkButton validate={validate} onSave={onSave}>
            Save
          </LinkButton>
        </BrowserRouter>
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
    it('shows confirmation dialog when configured', async () => {
      render(
        <BrowserRouter>
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
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeVisible();
        expect(screen.getByText('Are you sure?')).toBeVisible();
        expect(
          screen.getByRole('button', { name: 'cancel-confirmation-dialog' })
        ).toBeInTheDocument();
      });
    });

    it('executes action on confirm', async () => {
      const onSave = vi.fn();

      render(
        <BrowserRouter>
          <LinkButton
            confirmDialog={{
              enabled: true,
              message: 'Are you sure?',
            }}
            onSave={onSave}
          >
            Delete
          </LinkButton>
        </BrowserRouter>
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
        <BrowserRouter>
          <LinkButton
            confirmDialog={{
              enabled: true,
              message: 'Are you sure?',
            }}
            onSave={onSave}
          >
            Delete
          </LinkButton>
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(button);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: 'cancel-confirmation-dialog' });
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

      render(
        <BrowserRouter>
          <LinkButton steps={[{ execute: step1 }, { execute: step2 }]}>Execute</LinkButton>
        </BrowserRouter>
      );

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
        <BrowserRouter>
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
        </BrowserRouter>
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
        <BrowserRouter>
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
        </BrowserRouter>
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

      render(
        <BrowserRouter>
          <LinkButton onSave={onSave}>Save</LinkButton>
        </BrowserRouter>
      );

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
        <BrowserRouter>
          <LinkButton onSave={onSave} onCleanup={onCleanup}>
            Save
          </LinkButton>
        </BrowserRouter>
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
        <BrowserRouter>
          <LinkButton onBeforeAction={onBeforeAction} onSave={onSave}>
            Save
          </LinkButton>
        </BrowserRouter>
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
        <BrowserRouter>
          <LinkButton onSave={onSave} onSuccess={onSuccess}>
            Save
          </LinkButton>
        </BrowserRouter>
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
        <BrowserRouter>
          <LinkButton onSave={onSave} onError={onError}>
            Save
          </LinkButton>
        </BrowserRouter>
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

      render(
        <BrowserRouter>
          <LinkButton onSave={onSave}>Save</LinkButton>
        </BrowserRouter>
      );

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
        <BrowserRouter>
          <LinkButton to="/next" onBeforeNavigate={onBeforeNavigate}>
            Next
          </LinkButton>
        </BrowserRouter>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onBeforeNavigate).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/next', expect.any(Object));
      });
    });

    it('supports onSuccessNavigate', async () => {
      const onSuccessNavigate = vi.fn();

      render(
        <BrowserRouter>
          <LinkButton to="/next" onSuccessNavigate={onSuccessNavigate}>
            Next
          </LinkButton>
        </BrowserRouter>
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

  it('manages loading state correctly', async () => {
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
    expect(mockNavigate).toHaveBeenCalledWith('/success', expect.any(Object));
  });

  it('handles errors correctly', async () => {
    const error = new Error('Test error');
    const onSave = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    const { result } = renderHook(() => useLinkButton({ onSave, onError }));

    await act(async () => {
      try {
        await result.current.executeAction();
      } catch (e) {
        // Expected error
      }
    });

    expect(onError).toHaveBeenCalledWith(error);
  });
});
