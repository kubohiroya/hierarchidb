import { Outlet, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from "~/loader";

export async function clientLoader(args: LoaderFunctionArgs) {
  // Don't load if targetNodeId is undefined
  if (!args.params.targetNodeId || args.params.targetNodeId === 'undefined') {
    return null;
  }
  return await loadTargetTreeNode(args.params as LoadTargetTreeNodeArgs);
}

export default function TLayout() {
  const { targetNodeId } = useParams();
  
  // Don't render Outlet if targetNodeId is undefined
  if (!targetNodeId || targetNodeId === 'undefined') {
    return null;
  }
  
  return <Outlet />;
}
