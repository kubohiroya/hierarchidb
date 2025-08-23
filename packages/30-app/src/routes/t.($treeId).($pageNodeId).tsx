import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadPageTreeNode, LoadPageTreeNodeArgs } from "~/loader";
import { type NodeId } from "@hierarchidb/00-core";


export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageTreeNodeArgs;
  
  // pageNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageNodeId = params.pageNodeId || (`${params.treeId}Root` as NodeId);
  const actualPageNodeId = pageNodeId === "undefined" ? (`${params.treeId}Root` as NodeId) : pageNodeId;
  
  return await loadPageTreeNode({
    ...params,
    pageNodeId: actualPageNodeId
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.pageTreeNode) {
    return;
  }
  return (
    <div>
      <h2>t.($treeId).($pageNodeId)</h2>
      <ul>
        <li>{data.tree?.id}</li>
        <li>{data.tree?.name}</li>
        <li>{data.pageTreeNode?.id}</li>
        <li>{data.pageTreeNode?.name}</li>
      </ul>
      {/* Don't render Outlet (which includes targetNodeId routes) if we're at the pageNodeId level only */}
      <Outlet />
    </div>
  );
}
