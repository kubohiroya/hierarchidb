/**
 * IFrame
 */
import { useEffect } from 'react';
import { useAuth } from '@hierarchidb/ui-shell/ui-auth';

export default function SilentRenewRoute() {
  const { resumeAfterSignIn } = useAuth();

  useEffect(() => {
    async function renew() {
      try {
        resumeAfterSignIn();
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: 'silent-renew-success' },
            window.location.origin,
          );
        }
      } catch (error) {
        console.error('Silent renew failed:', error);
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: 'silent-renew-error', error: error?.toString() },
            window.location.origin,
          );
        }
      }
    }

    renew();
  }, [resumeAfterSignIn]);

  return <div />;
}