import { Outlet, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { loadPageNode, LoadPageNodeArgs } from '~/loader';
import { type NodeId } from '@hierarchidb/common-core';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageNodeArgs;

  // pageNodeIdが省略された場合、デフォルトのルートノードIDを設定
  const pageNodeId = params.nodeId || (`${params.treeId}Root` as NodeId);
  const actualPageNodeId =
    pageNodeId === 'undefined' ? (`${params.treeId}Root` as NodeId) : pageNodeId;

  return await loadPageNode({
    ...params,
    nodeId: actualPageNodeId,
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.pageNode) {
    return;
  }
  return <Outlet />;
}
