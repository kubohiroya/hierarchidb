import type { LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader';
import { type NodeId } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetNodeArgs;

  //  pageNodeIdID
  const pageNodeId = params.pageNodeId || (`${params.treeId}Root` as NodeId);
  const actualPageNodeId =
    pageNodeId === 'undefined' ? (`${params.treeId}Root` as NodeId) : pageNodeId;

  return await loadTargetNode({
    ...params,
    pageNodeId: actualPageNodeId,
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.targetNode) {
    return;
  }
  return <Outlet />;
}
