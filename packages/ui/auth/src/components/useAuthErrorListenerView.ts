import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

type UseAuthErrorListenerViewArgs = {
  fallbackTo: string;
};

export const useAuthErrorListenerView = ({ fallbackTo }: UseAuthErrorListenerViewArgs) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthErrorEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      console.log('Auth error detected:', customEvent.detail?.message);

      localStorage.setItem('oidc.redirect', window.location.pathname);
      void navigate({ to: fallbackTo, replace: true });
    };

    window.addEventListener('Auth-error', handleAuthErrorEvent);
    return () => {
      window.removeEventListener('Auth-error', handleAuthErrorEvent);
    };
  }, [fallbackTo, navigate]);
};
