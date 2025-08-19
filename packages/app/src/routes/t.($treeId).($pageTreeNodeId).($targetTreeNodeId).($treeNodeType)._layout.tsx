import { Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTreeNodeType, LoadTreeNodeTypeArgs } from "~/loader";

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeType(args.params as LoadTreeNodeTypeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
