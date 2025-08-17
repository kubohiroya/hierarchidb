import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

//import { APP_PREFIX } from "@/config/appDescription";
//`/${APP_PREFIX}/`
/**
 * 認証エラーイベントをリッスンして、再認証画面へのリダイレクトを行うコンポーネント
 */
export function AuthErrorListener({ fallbackTo }: { fallbackTo: string }): null {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    const handleAuthErrorEvent = (_event: CustomEvent) => {
      // devLog("認証エラーを検出しました:", event.detail?.message);

      // 現在のパスをセッションストレージに保存
      sessionStorage.setItem('oidc.redirect', window.location.pathname);

      // トップページへリダイレクト
      navigate(fallbackTo, { replace: true });
    };

    // イベントリスナーを追加
    window.addEventListener('Auth-error', handleAuthErrorEvent as EventListener);

    // クリーンアップ
    return () => {
      window.removeEventListener('Auth-error', handleAuthErrorEvent as EventListener);
    };
  }, [navigate, auth]);

  return null;
}
