import type { ButtonProps } from '@mui/material';
import { useId } from 'react';
import type { LinkButtonProps } from './LinkButton.js';

export interface UseLinkButtonViewResult {
  buttonProps: Omit<ButtonProps, 'onClick'>;
  children: LinkButtonProps['children'];
  ariaLabel: LinkButtonProps['ariaLabel'];
  confirmDialog: LinkButtonProps['confirmDialog'];
  loadingText: LinkButtonProps['loadingText'];
  titleId: string;
  descriptionId: string;
}

export function useLinkButtonView(props: LinkButtonProps): UseLinkButtonViewResult {
  const titleId = useId();
  const descriptionId = useId();

  const {
    to: _to,
    replace: _replace,
    state: _state,
    validate: _validate,
    confirmDialog,
    onSave: _onSave,
    onCleanup: _onCleanup,
    steps: _steps,
    onBeforeNavigate: _onBeforeNavigate,
    onBeforeAction: _onBeforeAction,
    onSuccessNavigate: _onSuccessNavigate,
    onSuccess: _onSuccess,
    onError: _onError,
    loadingText,
    preventDoubleClick: _preventDoubleClick,
    showSuccessMessage: _showSuccessMessage,
    successMessage: _successMessage,
    successToast: _successToast,
    errorToast: _errorToast,
    onToast: _onToast,
    ariaLabel,
    children,
    validationErrors: _validationErrors,
    ...buttonProps
  } = props;

  return {
    buttonProps,
    children,
    ariaLabel,
    confirmDialog,
    loadingText,
    titleId,
    descriptionId,
  };
}
