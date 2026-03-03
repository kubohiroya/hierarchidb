import { useAuthErrorListenerView } from './useAuthErrorListenerView.js';

export function AuthErrorListener({ fallbackTo }: { fallbackTo: string }): null {
  useAuthErrorListenerView({ fallbackTo });
  return null;
}
