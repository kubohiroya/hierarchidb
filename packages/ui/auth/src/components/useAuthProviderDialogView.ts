import { useCallback, useId } from 'react';
import type { AuthProviderType } from '~/types/AuthProviderType';

type UseAuthProviderDialogViewArgs = {
  onSelectProvider: (provider: AuthProviderType) => void;
  onClose: () => void;
};

export const useAuthProviderDialogView = ({
  onSelectProvider,
  onClose,
}: UseAuthProviderDialogViewArgs) => {
  const titleId = useId();

  const handleProviderSelect = useCallback((provider: AuthProviderType) => {
    onSelectProvider(provider);
    onClose();
  }, [onClose, onSelectProvider]);

  return {
    titleId,
    handleProviderSelect,
  };
};
