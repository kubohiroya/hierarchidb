// Components
export * from './components/AuthErrorBoundary';
export * from './components/AuthErrorListener';
export * from './components/AuthMethodSettings';
export * from './components/AuthPanel';
export * from './components/AuthProviderDialog';
export * from './components/AuthProviderOption';
export * from './components/AuthProviderPrompt';
export * from './components/MicrosoftIcon';
export * from './components/OidcProvider';
export * from './components/UserAvatar';
export * from './components/UserAvatarMenu';
export * from './components/UserLoginButton';

// Contexts
export * from './contexts/GoogleAuthContext';
export * from './contexts/MultiAuthContext';
export * from './contexts/OIDCAuthContext';

// Types
export * from './types/AuthProviderType';
export * from './types/AuthUser';
export * from './types/AuthContextType';
export * from './types/AuthProviderConfig';

// Services
export * from './services/AuthCallbackHandler';
export * from './services/PopupDetectionService';

// Hooks - useBFFAuthからgetIdTokenを優先的にエクスポート
export { useBFFAuth, getIdToken } from './hooks/useBFFAuth';

// Obsolete hooks are not exported to avoid build issues
// If you need to use obsolete hooks, import them directly from their paths
