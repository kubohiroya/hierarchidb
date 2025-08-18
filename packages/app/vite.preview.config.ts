import { defineConfig, loadEnv } from 'vite';

// Preview-specific config without React Router plugin
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  const base = appName ? `/${appName}/` : '/';

  return {
    base,
    preview: {
      port: 4173,
      open: true,
      host: true,
    },
    build: {
      outDir: 'build/client',
    },
  };
});