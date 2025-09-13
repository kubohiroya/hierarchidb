import type { LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { loadPageNode, LoadPageNodeArgs } from '~/loader';
import { type NodeId } from '@hierarchidb/common-type';

export async function clientLoader(args: LoaderFunctionArgs) {
  const params = args.params as LoadPageNodeArgs;
  const pageNodeId = params.pageNodeId || (`${params.treeId}:root` as NodeId);

  return await loadPageNode({
    ...params,
    pageNodeId,
  });
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();
  if (!data.pageNode) {
    //return;
    throw new Error('data.pageNode is undefined')
  }


  return <Outlet />;
}
