/**
 * ログインページ
 * Turnstile検証付きのOAuth2認証
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Box, Container, Paper } from "@mui/material";
import { LoginForm, useAuth } from "@hierarchidb/ui-auth";

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { initiateOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Get the return URL from state or default to home
  const from = location.state?.from?.pathname || "/";

  const handleLogin = async (provider: string, turnstileToken: string) => {
    try {
      setError(null);
      
      // Store return URL for after authentication
      sessionStorage.setItem("auth.returnUrl", from);
      
      // Initiate OAuth flow with Turnstile token
      await initiateOAuth(provider, turnstileToken);
      
      // The OAuth flow will redirect to the provider
      // Control will not return here
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 3,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            p: 4,
          }}
        >
          <LoginForm onLogin={handleLogin} />
          
          {error && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: "error.light",
                color: "error.contrastText",
                borderRadius: 1,
              }}
            >
              {error}
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}