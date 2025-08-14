import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { User } from 'oidc-client-ts';

// import { devError } from "@/shared/utils/logger";
const devError = (msg: string, error?: any) => console.error(msg, error);
/**
 * Hook to monitor token expiration and trigger silent renewal
 */
export function useTokenMonitor() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.user) return;

    // Check token expiration every minute
    const checkInterval = setInterval(() => {
      if (auth.user) {
        // Calculate time until expiration
        const expiresAt = auth.user.expires_at;
        const currentTime = Math.floor(Date.now() / 1000);
        const expiresIn = expiresAt ? expiresAt - currentTime : auth.user.expires_in;

        // Skip if we can't determine expiration
        if (expiresIn === undefined) {
          return;
        }

        // Only log if token is expiring soon or has expired
        if (expiresIn < 300) {
          // devLog(
          // expiresIn <= 0
          // ? `Token has expired ${Math.abs(expiresIn)} seconds ago`
          // : `Token expires in ${expiresIn} seconds`,
          // );
        }

        // If token has expired or expires in less than 5 minutes, trigger silent renew
        // Also check if not already loading to avoid multiple renewal attempts
        if (expiresIn < 300 && !auth.isLoading && !auth.activeNavigator) {
          // devLog(
          // expiresIn <= 0
          // ? "Token has expired, triggering silent renew..."
          // : "Token expiring soon, triggering silent renew...",
          // );
          auth.signinSilent().catch((error) => {
            devError('Silent renew failed:', error);
            // If silent renew fails and token is expired, might need to re-authenticate
            if (expiresIn <= 0) {
              devError(
                'Token is expired and silent renew failed. User may need to re-authenticate.'
              );
            }
          });
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [auth]);

  // Listen for Auth events
  useEffect(() => {
    const handleUserLoaded = (_user: User) => {
      // devLog("User loaded:", user.profile.email);
    };

    const handleUserUnloaded = () => {
      // devLog("User unloaded");
    };

    const handleAccessTokenExpiring = () => {
      // devLog("Access token expiring, triggering silent renew...");
    };

    const handleAccessTokenExpired = () => {
      // devLog("Access token expired");
    };

    const handleSilentRenewError = (error: Error) => {
      devError('Silent renew error:', error);
    };

    // Add event listeners
    auth.events.addUserLoaded(handleUserLoaded);
    auth.events.addUserUnloaded(handleUserUnloaded);
    auth.events.addAccessTokenExpiring(handleAccessTokenExpiring);
    auth.events.addAccessTokenExpired(handleAccessTokenExpired);
    auth.events.addSilentRenewError(handleSilentRenewError);

    return () => {
      // Remove event listeners
      auth.events.removeUserLoaded(handleUserLoaded);
      auth.events.removeUserUnloaded(handleUserUnloaded);
      auth.events.removeAccessTokenExpiring(handleAccessTokenExpiring);
      auth.events.removeAccessTokenExpired(handleAccessTokenExpired);
      auth.events.removeSilentRenewError(handleSilentRenewError);
    };
  }, [auth]);
}
