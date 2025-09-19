import type { LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader.js';
import { NodeId } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetNodeArgs & { nodeType: string };
  //  pageNodeIdID
  const pageNodeId = params.pageNodeId || (`${params.treeId}:root` as NodeId);
  const actualPageNodeId =
    !pageNodeId ? (`${params.treeId}:root` as NodeId) : pageNodeId;

  const result = await loadTargetNode({
    ...params,
    pageNodeId: actualPageNodeId,
  });
  return { ...result, nodeType: params.nodeType };
}

export default function NodeTypeOutlet() {
  return <Outlet />;
}
