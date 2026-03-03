import { useMemo } from 'react';
import {
  GitHub as GitHubIcon,
  Google as GoogleIcon,
  Microsoft as MicrosoftIcon,
} from '@mui/icons-material';
import type React from 'react';
import type { AuthProvider } from '../hooks/useAuthRequiredDialog';

interface AuthProviderInfo {
  name: string;
  icon: React.ComponentType;
  color: string;
  description: string;
}

const AUTH_PROVIDERS: Record<AuthProvider, AuthProviderInfo> = {
  google: {
    name: 'Google',
    icon: GoogleIcon,
    color: '#4285f4',
    description: 'Sign in with your Google account',
  },
  github: {
    name: 'GitHub',
    icon: GitHubIcon,
    color: '#333',
    description: 'Sign in with your GitHub account',
  },
  microsoft: {
    name: 'Microsoft',
    icon: MicrosoftIcon,
    color: '#0078d4',
    description: 'Sign in with your Microsoft account',
  },
};

type UseAuthRequiredDialogViewArgs = {
  pluginType: string;
  retryCount: number;
  message?: string;
  cancelLabel?: string;
  sessionId?: string;
  showSessionDetails: boolean;
  selectedProvider: AuthProvider | null;
  isAuthenticating: boolean;
  isMicrosoftProviderDisabled: (provider: AuthProvider) => boolean;
};

export const useAuthRequiredDialogView = ({
  pluginType,
  retryCount,
  message,
  cancelLabel,
  sessionId,
  showSessionDetails,
  selectedProvider,
  isAuthenticating,
  isMicrosoftProviderDisabled,
}: UseAuthRequiredDialogViewArgs) => {
  const providerEntries = useMemo(() => (
    (Object.keys(AUTH_PROVIDERS) as AuthProvider[]).map((provider) => {
      const info = AUTH_PROVIDERS[provider];
      const isSelected = selectedProvider === provider;
      const isDisabled = isMicrosoftProviderDisabled(provider) || (isAuthenticating && !isSelected);
      return {
        provider,
        info,
        isSelected,
        isDisabled,
      };
    })
  ), [isAuthenticating, isMicrosoftProviderDisabled, selectedProvider]);

  const pluginLabel = useMemo(() => (
    pluginType.charAt(0).toUpperCase() + pluginType.slice(1)
  ), [pluginType]);

  const resolvedMessage = useMemo(() => (
    message || `The ${pluginType} plugin requires authentication to continue batch processing.`
  ), [message, pluginType]);

  const retryMessage = useMemo(() => {
    if (retryCount <= 0) return null;
    return `This is attempt #${retryCount + 1} to resolve the authentication issue.`;
  }, [retryCount]);

  const cancelButtonLabel = cancelLabel ?? 'Cancel';
  const sessionSuffix = sessionId ? sessionId.slice(-12) : null;
  const shouldShowSessionInfo = showSessionDetails && Boolean(sessionSuffix);

  return {
    providerEntries,
    pluginLabel,
    resolvedMessage,
    retryMessage,
    cancelButtonLabel,
    sessionSuffix,
    shouldShowSessionInfo,
  };
};
