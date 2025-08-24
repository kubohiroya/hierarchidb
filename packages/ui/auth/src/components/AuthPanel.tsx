// utils/App.jsx
import { Button, Snackbar } from "@mui/material";

import Gravatar from "react-gravatar";
import { useAuth } from "react-oidc-context";
// import { useAuthLib as useAuthLib } from "@/shared/auth/hooks/useAuthLib.ts";
const useAuthLib = () => ({
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
});

function AuthPanel() {
  const auth = useAuth();
  const { signIn, signOut } = useAuthLib();

  switch (auth.activeNavigator) {
    case "signinSilent":
      return <Snackbar message="Signing you in..." />;
    case "signoutRedirect":
      return <Snackbar message="Signing you out..." />;
  }

  if (auth.isLoading) {
    return <Snackbar message="Loading..." />;
  }

  if (auth.error) {
    return (
      <Snackbar
        message={`Oops... ${auth.error.name} caused ${auth.error.message}`}
      />
    );
  }

  if (auth.isAuthenticated) {
    return (
      <Gravatar
        email={auth.user?.profile.email}
        style={{ borderRadius: "50%" }}
      >
        <Button onClick={() => signOut()}>Log out</Button>
      </Gravatar>
    );
  }

  return (
    <Button variant={"outlined"} onClick={() => signIn()}>
      Log in
    </Button>
  );
}

export default AuthPanel;
