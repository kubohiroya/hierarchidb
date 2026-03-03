// utils/App.jsx
import { Button, Snackbar } from '@mui/material';

import Gravatar from 'react-gravatar';
import { useAuth } from 'react-oidc-context';
import { useAuthPanelView } from './useAuthPanelView.js';

// import { useAuthLib as useAuthLib } from "@/shared/auth/hooks/useAuthLib.ts";
const useAuthLib = () => ({
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
});

export function AuthPanel() {
  const auth = useAuth();
  const { signIn, signOut } = useAuthLib();
  const view = useAuthPanelView({ auth });

  if (view.kind === 'navigator' || view.kind === 'loading' || view.kind === 'error') {
    return <Snackbar message={view.message} />;
  }

  if (view.kind === 'authenticated') {
    return (
      <Gravatar email={view.email} style={{ borderRadius: '50%' }}>
        <Button onClick={() => signOut()}>Log out</Button>
      </Gravatar>
    );
  }

  return (
    <Button variant={'outlined'} onClick={() => signIn()}>
      Log in
    </Button>
  );
}
