// Components
export { AuthErrorBoundary } from './components/AuthErrorBoundary.js';
export { AuthErrorListener } from './components/AuthErrorListener.js';
export { AuthMethodSettings } from './components/AuthMethodSettings.js';
export { AuthProviderDialog } from './components/AuthProviderDialog.js';
export type { AuthProviderOption } from './components/AuthProviderOption.js';
export { AuthProviderOptions } from './components/AuthProviderOptions.js';
export { AuthProviderPrompt, AuthRequiredPrompt } from './components/AuthProviderPrompt.js';
export { AuthReadyGate } from './components/AuthReadyGate.js';
export type { AuthRequiredDialogProps } from './components/AuthRequiredDialog.js';
export { AuthRequiredDialog } from './components/AuthRequiredDialog.js';
export { LoginForm } from './components/LoginForm.js';
export { MicrosoftIcon } from './components/MicrosoftIcon.js';
export { OAuthCallback } from './components/OAuthCallback.js';
export { OidcProvider } from './components/OidcProvider.js';
export { UserAvatar } from './components/UserAvatar.js';
export { UserAvatarMenu, UserProfile } from './components/UserAvatarMenu.js';

// Contexts
export { GoogleAuthProvider, useGoogleAuth } from './contexts/GoogleAuthContext.js';
export { MultiAuthProvider, useMultiAuth } from './contexts/MultiAuthContext.js';
export { OIDCAuthProvider, useOIDCAuth } from './contexts/OIDCAuthContext.js';
export { SimpleBFFAuthProvider, useSimpleBFFAuth } from './contexts/SimpleBFFAuthContext.js';
// Hooks
export { getIdToken, useAuth } from './hooks/useAuth.js';
// Services
export { AuthCallbackHandler } from './services/AuthCallbackHandler.js';
export type { AuthMethod } from './services/AuthService.js';
export { AuthService } from './services/AuthService.js';
export type { BFFAuthResponse, BFFSignInOptions, BFFUser } from './services/BFFAuthService.js';
export { BFFAuthService } from './services/BFFAuthService.js';
export { handleAuthError } from './services/handleAuthError.js';
export type { PopupCapability } from './services/PopupDetectionService.js';
export { PopupDetectionService } from './services/PopupDetectionService.js';
export { registerAuthUIHandlers } from './services/UIAuthRecoveryClient.js';
export type { AuthContextType } from './types/AuthContextType.js';
export type { AuthProviderConfig } from './types/AuthProviderConfig.js';
// Types
export type { AuthProviderType } from './types/AuthProviderType.js';
export type { AuthUser } from './types/AuthUser.js';
