import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from "~/loader";
import { type NodeId } from "@hierarchidb/00-core";


export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetTreeNodeArgs;
  
  // pageNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageNodeId = params.pageNodeId || (`${params.treeId}Root` as NodeId);
  const actualPageNodeId = pageNodeId === "undefined" ? (`${params.treeId}Root` as NodeId) : pageNodeId;
  
  return await loadTargetTreeNode({
    ...params,
    pageNodeId: actualPageNodeId
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.targetTreeNode) {
    return;
  }
  return (
    <>
      <h3>t.($treeId).($pageNodeId).($targetNodeId)</h3>
      <ul>
        <li>{data.tree?.id}</li>
        <li>{data.tree?.name}</li>
        <li>{data.pageTreeNode?.id}</li>
        <li>{data.pageTreeNode?.name}</li>
        <li>{data.targetTreeNode?.id}</li>
        <li>{data.targetTreeNode?.name}</li>
      </ul>
      <Outlet />
    </>
  );
}
