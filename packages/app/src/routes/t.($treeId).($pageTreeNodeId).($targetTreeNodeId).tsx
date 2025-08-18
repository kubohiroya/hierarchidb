import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTargetTreeNode(args.params as LoadTargetTreeNodeArgs);
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
