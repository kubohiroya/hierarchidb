import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { copyFile } from 'node:fs/promises';
import path from 'node:path';

// 現在のファイルのディレクトリを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境を判定（NODE_ENVまたはデフォルトでdevelopment）
const mode = process.env.NODE_ENV || 'development';

// .env.*ファイルから環境変数を読み込み
// 第2引数にpackages/appディレクトリを指定
const env = loadEnv(mode, __dirname, '');

// VITE_APP_NAMEを使用してvite.config.tsと統一
const appName = env.VITE_APP_NAME || '';

// 開発環境と本番環境でbasenameを適切に設定
// React Routerは空文字列ではなく'/'を期待
const basename = appName ? `/${appName}/` : '/';

// React Router config type
interface ReactRouterConfig {
  appDirectory: string;
  prerender: boolean;
  ssr: boolean;
  basename: string; // 必須にする
}
/*
  buildEnd?: (args: { viteConfig: any }) => Promise<void>;
async buildEnd(args): Promise<void> {
  if (!args.viteConfig.isProduction) return;
const buildPath = args.viteConfig.build.outDir;
await copyFile(path.join(buildPath, 'index.html'), path.join(buildPath, '404.html'));
},
 */

const config: ReactRouterConfig = {
  appDirectory: 'src',
  prerender: false,
  ssr: false, // SSRを無効化
  basename,
};

export default config;
