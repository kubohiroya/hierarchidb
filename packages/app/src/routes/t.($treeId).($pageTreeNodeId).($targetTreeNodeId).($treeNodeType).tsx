import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTreeNodeType, LoadTreeNodeTypeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeType(args.params as LoadTreeNodeTypeArgs);
}

export default function TLayout() {
  const data = useLoaderData();
  if (!data.treeNodeType) {
    return;
  }
  return (
    <>
      <h4>t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType)</h4>
      <ul>
        <li>{data.tree.treeId}</li>
        <li>{data.tree.name}</li>
        <li>{data.pageTreeNode?.treeNodeId}</li>
        <li>{data.pageTreeNode?.name}</li>
        <li>{data.targetTreeNode?.treeNodeId}</li>
        <li>{data.targetTreeNode?.name}</li>
        <li>{data.treeNodeType}</li>
      </ul>
      <Outlet />
    </>
  );
}
