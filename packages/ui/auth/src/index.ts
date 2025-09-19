// Components
export { AuthErrorBoundary } from './components/AuthErrorBoundary.js';
export { LoginForm } from './components/LoginForm.js';
export { AuthErrorListener } from './components/AuthErrorListener.js';
export { AuthMethodSettings } from './components/AuthMethodSettings.js';
export { AuthProviderDialog } from './components/AuthProviderDialog.js';
export type { AuthProviderOption } from './components/AuthProviderOption.js';
export { AuthProviderOptions } from './components/AuthProviderOptions.js';
export { AuthProviderPrompt, AuthRequiredPrompt } from './components/AuthProviderPrompt.js';
export { AuthRequiredDialog } from './components/AuthRequiredDialog.js';
export type { AuthRequiredDialogProps } from './components/AuthRequiredDialog.js';
export { MicrosoftIcon } from './components/MicrosoftIcon.js';
export { OAuthCallback } from './components/OAuthCallback.js';
export { OidcProvider } from './components/OidcProvider.js';
export { UserAvatar } from './components/UserAvatar.js';
export { UserProfile, UserAvatarMenu } from './components/UserAvatarMenu.js';

// Contexts
export { useGoogleAuth, GoogleAuthProvider } from './contexts/GoogleAuthContext.js';
export { useMultiAuth, MultiAuthProvider } from './contexts/MultiAuthContext.js';
export { useOIDCAuth, OIDCAuthProvider } from './contexts/OIDCAuthContext.js';
export { useSimpleBFFAuth, SimpleBFFAuthProvider } from './contexts/SimpleBFFAuthContext.js';

// Types
export type { AuthProviderType } from './types/AuthProviderType.js';
export type { AuthUser } from './types/AuthUser.js';
export type { AuthContextType } from './types/AuthContextType.js';
export type { AuthProviderConfig } from './types/AuthProviderConfig.js';

// Services
export { AuthCallbackHandler } from './services/AuthCallbackHandler.js';
export { BFFAuthService } from './services/BFFAuthService.js';
export type { BFFUser, BFFSignInOptions, BFFAuthResponse } from './services/BFFAuthService.js';
export { PopupDetectionService } from './services/PopupDetectionService.js';
export type { PopupCapability } from './services/PopupDetectionService.js';
export { AuthService } from './services/AuthService.js';
export type { AuthMethod } from './services/AuthService.js';
export { handleAuthError } from './services/handleAuthError.js';
export { registerAuthUIHandlers } from './services/UIAuthRecoveryClient.js';

// Hooks
export { useAuth, getIdToken } from './hooks/useAuth.js';
