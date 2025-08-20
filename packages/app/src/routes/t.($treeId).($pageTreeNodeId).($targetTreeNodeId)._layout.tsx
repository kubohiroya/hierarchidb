import { Outlet, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from "~/loader";

export async function clientLoader(args: LoaderFunctionArgs) {
  // Don't load if targetTreeNodeId is undefined
  if (!args.params.targetTreeNodeId || args.params.targetTreeNodeId === 'undefined') {
    return null;
  }
  return await loadTargetTreeNode(args.params as LoadTargetTreeNodeArgs);
}

export default function TLayout() {
  const { targetTreeNodeId } = useParams();
  
  // Don't render Outlet if targetTreeNodeId is undefined
  if (!targetTreeNodeId || targetTreeNodeId === 'undefined') {
    return null;
  }
  
  return <Outlet />;
}
