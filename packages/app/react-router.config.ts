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
// 通常のbasename設定（React Routerのビルドシステム用）
const basename = appName ? `/${appName}/` : '/';

// Hash routingの設定を環境変数から取得（buildEnd用）
// デフォルトはtrue（ハッシュルーティング有効）
const useHashRouting = env.VITE_USE_HASH_ROUTING !== 'false';

// React Router config type
interface ReactRouterConfig {
  appDirectory: string;
  prerender: boolean;
  ssr: boolean;
  basename: string; // 必須にする
  buildEnd?: (args: { viteConfig: any }) => Promise<void>;
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
  async buildEnd(args): Promise<void> {
    if (!args.viteConfig.isProduction) return;
    const buildPath = args.viteConfig.build.outDir;
    
    // Hash routingの場合は404.htmlは不要
    if (useHashRouting) {
      console.log('Hash routing enabled - skipping 404.html generation');
      return;
    }
    
    // GitHub Pages用の404.htmlを作成（SPAルーティング対応）
    const notFoundHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>HierarchiDB</title>
    <script type="text/javascript">
      // GitHub Pages用のSPA対応スクリプト
      // 404ページから正しいパスにリダイレクト
      var pathSegmentsToKeep = 1; // hierarchidbという1つのセグメントを保持

      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>
  </body>
</html>`;
    
    const fs = await import('node:fs/promises');
    await fs.writeFile(path.join(buildPath, '404.html'), notFoundHtml);
  },
};

export default config;
