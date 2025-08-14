/**
 * サイレントトークン更新ページ
 * IFrameで読み込まれ、バックグラウンドでトークンを更新
 */
import { useEffect } from 'react';
import { useBFFAuth } from '@hierarchidb/ui-auth';

export default function SilentRenewRoute() {
  const { resumeAfterSignIn } = useBFFAuth();

  useEffect(() => {
    async function renew() {
      try {
        resumeAfterSignIn();
        // 親ウィンドウに更新成功を通知
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'silent-renew-success' }, window.location.origin);
        }
      } catch (error) {
        console.error('Silent renew failed:', error);
        if (window.parent !== window) {
          window.parent.postMessage(
            { type: 'silent-renew-error', error: error?.toString() },
            window.location.origin
          );
        }
      }
    }

    renew();
  }, [resumeAfterSignIn]);

  // このページは表示されないため、最小限のレンダリング
  return <div />;
}
