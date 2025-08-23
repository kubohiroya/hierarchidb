import { defineConfig, loadEnv } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import * as path from "path";
import { tildeResolver } from "./vite-plugin-tilde-resolver";

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild, command }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), "");
  const appName = env.VITE_APP_NAME || "";
  // VITE_APP_NAMEが設定されている場合のみbaseを設定
  const base = appName ? `/${appName}/` : "/";

  // Hash routing設定を環境変数から取得
  const useHashRouting = env.VITE_USE_HASH_ROUTING !== "false";

  const isDev = mode === "development";

  return {
    base,
    plugins: [
      tildeResolver(),
      reactRouter(),
      tsconfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
    resolve: {
      // @emotion/reactとreactの重複を解決
      dedupe: ["@emotion/react", "@emotion/styled", "react", "react-dom"],
      alias: [
        // パッケージエイリアス
        { find: "@", replacement: path.resolve(__dirname, "./src") },
        // Core packages always use dist for stability
        {
          find: "@hierarchidb/core",
          replacement: path.resolve(__dirname, "../core/dist"),
        },
        {
          find: "@hierarchidb/api",
          replacement: path.resolve(__dirname, "../api/dist"),
        },
        {
          find: "@hierarchidb/worker",
          replacement: path.resolve(__dirname, "../worker/dist"),
        },
        // UI packages use src in development for HMR, dist in production
        {
          find: "@hierarchidb/ui-core",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/core/src" : "../ui/core/dist",
          ),
        },
        {
          find: "@hierarchidb/registry",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/client/src" : "../ui/client/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-auth",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/auth/src" : "../ui/auth/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-i18n",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/i18n/src" : "../ui/i18n/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-layout",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/layout/src" : "../ui/layout/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-navigation",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/navigation/src" : "../ui/navigation/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-routing",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/routing/src" : "../ui/routing/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-tour",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/tour/src" : "../ui/tour/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-file",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/file/src" : "../ui/file/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-monitoring",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/monitoring/src" : "../ui/monitoring/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-theme",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/theme/src" : "../ui/theme/dist",
          ),
        },
        // TreeConsole UI packages
        {
          find: "@hierarchidb/ui-treeconsole-base",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/base/src" : "../ui/treeconsole/base/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-breadcrumb",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/breadcrumb/src" : "../ui/treeconsole/breadcrumb/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-footer",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/footer/src" : "../ui/treeconsole/footer/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-speeddial",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/speeddial/src" : "../ui/treeconsole/speeddial/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-toolbar",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/toolbar/src" : "../ui/treeconsole/toolbar/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-trashbin",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/trashbin/src" : "../ui/treeconsole/trashbin/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-treeconsole-treetable",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/treeconsole/treetable/src" : "../ui/treeconsole/treetable/dist",
          ),
        },
        // Other UI packages
        {
          find: "@hierarchidb/ui-usermenu",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/usermenu/src" : "../ui/usermenu/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-import-export",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/import-export/src" : "../ui/import-export/dist",
          ),
        },
        {
          find: "@hierarchidb/ui-guide",
          replacement: path.resolve(
            __dirname,
            isDev ? "../ui/guide/src" : "../ui/guide/dist",
          ),
        },
        // Plugins always use dist for stability
        {
          find: "@hierarchidb/plugin-basemap",
          replacement: path.resolve(__dirname, "../plugins/basemap/dist"),
        },
        {
          find: "@hierarchidb/plugin-_shapes_buggy",
          replacement: path.resolve(__dirname, "../plugins/_shapes_buggy/dist"),
        },
        {
          find: "@hierarchidb/plugin-stylemap",
          replacement: path.resolve(__dirname, "../plugins/stylemap/dist"),
        },
      ],
    },
    server: {
      port: 4200,
      open: true,
      host: true,
    },
    worker: {
      format: "es",
      rollupOptions: {
        output: {
          entryFileNames: "[name].js",
        },
      },
    },
    build: {
      outDir: "dist",
      // production環境ではソースマップを無効化
      sourcemap: mode === "development",
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name][extname]",
          ...(isSsrBuild
            ? {}
            : {
                manualChunks: {
                  "vendor-react": ["react", "react-dom", "react-router-dom"],
                },
              }),
        },
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
      ],
      // @emotion/reactの重複を解決
      exclude: [],
      esbuildOptions: {
        // ビルド時の最適化
        target: "es2020",
      },
    },
  };
});
