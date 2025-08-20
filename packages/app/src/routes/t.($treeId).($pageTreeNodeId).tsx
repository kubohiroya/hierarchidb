import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadPageTreeNode, LoadPageTreeNodeArgs } from "~/loader";
import { TreeNodeTypes } from "@hierarchidb/core";

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageTreeNodeArgs;
  
  // pageTreeNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageTreeNodeId = params.pageTreeNodeId || (params.treeId + TreeNodeTypes.Root);
  const actualPageTreeNodeId = pageTreeNodeId === "undefined" ? (params.treeId + TreeNodeTypes.Root) : pageTreeNodeId;
  
  return await loadPageTreeNode({
    ...params,
    pageTreeNodeId: actualPageTreeNodeId
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.pageTreeNode) {
    return;
  }
  return (
    <div>
      <h2>t.($treeId).($pageTreeNodeId)</h2>
      <ul>
        <li>{data.tree?.treeId}</li>
        <li>{data.tree?.name}</li>
        <li>{data.pageTreeNode?.treeNodeId}</li>
        <li>{data.pageTreeNode?.name}</li>
      </ul>
      {/* Don't render Outlet (which includes targetTreeNodeId routes) if we're at the pageTreeNodeId level only */}
      <Outlet />
    </div>
  );
}
