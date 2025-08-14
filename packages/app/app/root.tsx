import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';

/**
 * ルートレベルでWorkerServicesを初期化
 * 全ての子ルートで利用可能になる
 */

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
