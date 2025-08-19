import { Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from "~/loader";

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTargetTreeNode(args.params as LoadTargetTreeNodeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
