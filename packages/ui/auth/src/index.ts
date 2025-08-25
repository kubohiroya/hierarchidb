// Components
export * from './components/AuthErrorBoundary';
export * from './components/AuthErrorListener';
export * from './components/AuthMethodSettings';
export * from './components/AuthPanel';
export * from './components/AuthProviderDialog';
export * from './components/AuthProviderOption';
export * from './components/AuthProviderPrompt';
export * from './components/MicrosoftIcon';
export * from './components/OAuthCallback';
export * from './components/OidcProvider';
export * from './components/UserAvatar';
export * from './components/UserAvatarMenu';
export * from './components/UserLoginButton';

// Contexts
export * from './contexts/GoogleAuthContext';
export * from './contexts/MultiAuthContext';
export * from './contexts/OIDCAuthContext';
export * from './contexts/SimpleBFFAuthContext';

// Types
export * from './types/AuthProviderType';
export * from './types/AuthUser';
export * from './types/AuthContextType';
export * from './types/AuthProviderConfig';

// Services
export * from './services/AuthCallbackHandler';
export * from './services/BFFAuthService';
export * from './services/PopupDetectionService';

// Hooks - V2版を使用
export { useBFFAuth, getIdToken } from './hooks/useBFFAuthV2';
// export { useBFFAuth, getIdToken } from './hooks/useBFFAuthSimple'; // Simple版
// export { useBFFAuth, getIdToken } from './hooks/useBFFAuth'; // 旧版（問題あり）

// Obsolete hooks are not exported to avoid build issues
// If you need to use obsolete hooks, import them directly from their paths
