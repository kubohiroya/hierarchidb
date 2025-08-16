import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadPageTreeNode, LoadPageTreeNodeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadPageTreeNode(args.params as LoadPageTreeNodeArgs);
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
      <Outlet />
    </div>
  );
}
