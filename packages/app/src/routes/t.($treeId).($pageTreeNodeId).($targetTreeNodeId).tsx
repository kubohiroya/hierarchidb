import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from "~/loader";
import { TreeNodeTypes } from "@hierarchidb/core";

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetTreeNodeArgs;
  
  // pageTreeNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageTreeNodeId = params.pageTreeNodeId || (params.treeId + TreeNodeTypes.Root);
  const actualPageTreeNodeId = pageTreeNodeId === "undefined" ? (params.treeId + TreeNodeTypes.Root) : pageTreeNodeId;
  
  return await loadTargetTreeNode({
    ...params,
    pageTreeNodeId: actualPageTreeNodeId
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.targetTreeNode) {
    return;
  }
  return (
    <>
      <h3>t.($treeId).($pageTreeNodeId).($targetTreeNodeId)</h3>
      <ul>
        <li>{data.tree?.treeId}</li>
        <li>{data.tree?.name}</li>
        <li>{data.pageTreeNode?.treeNodeId}</li>
        <li>{data.pageTreeNode?.name}</li>
        <li>{data.targetTreeNode?.treeNodeId}</li>
        <li>{data.targetTreeNode?.name}</li>
      </ul>
      <Outlet />
    </>
  );
}
