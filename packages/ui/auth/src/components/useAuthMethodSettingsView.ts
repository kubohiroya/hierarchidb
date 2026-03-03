import { useCallback, useId, useMemo } from 'react';

const AuthService = {
  getInstance: () => ({
    getAuthMethod: () => 'google' as const,
  }),
};

export const useAuthMethodSettingsView = () => {
  const authService = AuthService.getInstance();
  const currentMethod = authService.getAuthMethod();
  const controlId = useId();

  const labelId = `${controlId}-auth-method-label`;
  const popupId = `${controlId}-auth-method-popup`;
  const redirectId = `${controlId}-auth-method-redirect`;

  const handleChange = useCallback(() => {
    // No-op as changing is disabled
  }, []);

  const noteText = useMemo(
    () => 'Note: Page redirect option will be available in a future update with full state persistence support.',
    [],
  );

  return {
    currentMethod,
    labelId,
    popupId,
    redirectId,
    handleChange,
    noteText,
  };
};
