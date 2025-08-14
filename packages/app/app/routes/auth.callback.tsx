/**
 * 認証コールバックページ
 * OAuth2/OIDCプロバイダーからのリダイレクトを処理
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { AuthCallbackHandler } from '@hierarchidb/ui-auth';

export default function AuthCallbackRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  //const { handleCallback } = ;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        // URLパラメータから認証情報を取得
        const code = searchParams.get('code');
        //const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // 認証処理を実行
        await AuthCallbackHandler.handleCallback(); //{ code, state }

        // 元のページまたはホームへリダイレクト
        const returnUrl = sessionStorage.getItem('auth.returnUrl') || '/';
        sessionStorage.removeItem('auth.returnUrl');
        navigate(returnUrl, { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    processCallback();
  }, [searchParams, navigate]);

  // ポップアップモードの処理
  useEffect(() => {
    if (window.opener) {
      // ポップアップから親ウィンドウに認証情報を送信
      const params = Object.fromEntries(searchParams.entries());
      window.opener.postMessage({ type: 'auth-callback', params }, window.location.origin);
      window.close();
    }
  }, [searchParams]);

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography>
          <a href="/">Return to Home</a>
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" sx={{ mt: 3 }}>
        Completing authentication...
      </Typography>
    </Box>
  );
}
