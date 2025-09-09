import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

//import { APP_PREFIX } from "@/config/appDescription";
//`/${APP_PREFIX}/`
/**
    */
export function AuthErrorListener({ fallbackTo }: { fallbackTo: string }): null {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    const handleAuthErrorEvent = (_event: CustomEvent) => {
      // if (import.meta.env.DEV) {
      console.log('認証エラーを検出しました:', _event.detail?.message);
      // }

      sessionStorage.setItem('oidc.redirect', window.location.pathname);

      navigate(fallbackTo, { replace: true });
    };

    window.addEventListener('Auth-error', handleAuthErrorEvent as EventListener);

    return () => {
      window.removeEventListener('Auth-error', handleAuthErrorEvent as EventListener);
    };
  }, [navigate, auth]);

  return null;
}
