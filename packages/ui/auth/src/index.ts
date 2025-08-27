// Components
export { AuthErrorBoundary } from './components/AuthErrorBoundary';
export { LoginForm } from './components/LoginForm';
export { AuthErrorListener } from './components/AuthErrorListener';
export { AuthMethodSettings } from './components/AuthMethodSettings';
export { AuthProviderDialog } from './components/AuthProviderDialog';
export type { AuthProviderOption } from './components/AuthProviderOption';
export { AuthProviderOptions } from './components/AuthProviderOptions';
export { AuthProviderPrompt, AuthRequiredPrompt } from './components/AuthProviderPrompt';
export { MicrosoftIcon } from './components/MicrosoftIcon';
export { OAuthCallback } from './components/OAuthCallback';
export { OidcProvider } from './components/OidcProvider';
export { UserAvatar } from './components/UserAvatar';
export { UserProfile, UserAvatarMenu } from './components/UserAvatarMenu';

// Contexts
export { useGoogleAuth, GoogleAuthProvider } from './contexts/GoogleAuthContext';
export { useMultiAuth, MultiAuthProvider } from './contexts/MultiAuthContext';
export { useOIDCAuth, OIDCAuthProvider } from './contexts/OIDCAuthContext';
export { useSimpleBFFAuth, SimpleBFFAuthProvider } from './contexts/SimpleBFFAuthContext';

// Types
export type { AuthProviderType } from './types/AuthProviderType';
export type { AuthUser } from './types/AuthUser';
export type { AuthContextType } from './types/AuthContextType';
export type { AuthProviderConfig } from './types/AuthProviderConfig';

// Services
export { AuthCallbackHandler } from './services/AuthCallbackHandler';
export { BFFAuthService } from './services/BFFAuthService';
export type { BFFUser, BFFSignInOptions, BFFAuthResponse } from './services/BFFAuthService';
export { PopupDetectionService } from './services/PopupDetectionService';
export type { PopupCapability } from './services/PopupDetectionService';
export { AuthService } from './services/AuthService';
export type { AuthMethod } from './services/AuthService';
export { handleAuthError } from './services/handleAuthError';

// Hooks
export { useAuth, getIdToken } from './hooks/useAuth';
