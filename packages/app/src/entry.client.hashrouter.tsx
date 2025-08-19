import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import routes from "./routes";

// HashRouter用のエントリーポイント
// GitHub Pages等の静的ホスティング環境用

async function createApp() {
  const resolvedRoutes = await routes;
  // flatRoutes() provides RouteConfig entries; cast to RouteObject[] for client router
  return createHashRouter(resolvedRoutes as unknown as any);
}

startTransition(async () => {
  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");

  const router = await createApp();
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
