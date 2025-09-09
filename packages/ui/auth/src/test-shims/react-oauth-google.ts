// Lightweight stub for '@react-oauth/google' used in tests.
// Provides useGoogleLogin without requiring GoogleOAuthProvider context.

type TokenResponse = { access_token: string; expires_in?: number };

export function useGoogleLogin(config?: {
  onSuccess?: (res: TokenResponse) => void;
  onError?: (err: unknown) => void;
  flow?: string;
}) {
  return (/* args?: any */) => {
    try {
      config?.onSuccess?.({ access_token: 'test-google-access-token', expires_in: 3600 });
    } catch (e) {
      config?.onError?.(e);
    }
  };
}

export default { useGoogleLogin };

