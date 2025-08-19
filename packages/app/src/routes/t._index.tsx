import { Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadWorkerAPIClient } from "~/loader";

export async function clientLoader(_args: LoaderFunctionArgs) {
  return await loadWorkerAPIClient();
}

export default function TLayout() {
  return (
    <div>
      <h1>[t._index]</h1>
      <Outlet />
    </div>
  );
}
