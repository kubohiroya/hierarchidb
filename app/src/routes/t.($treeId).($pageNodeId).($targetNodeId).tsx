import type { LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader';
import { type NodeId } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadTargetNodeArgs;

  //  pageNodeIdID
  const pageNodeId = params.pageNodeId || (`${params.treeId}:root` as NodeId);

  return await loadTargetNode({
    ...params,
    pageNodeId,
  });
}

export default function TLayout() {
  return <Outlet />;
}
