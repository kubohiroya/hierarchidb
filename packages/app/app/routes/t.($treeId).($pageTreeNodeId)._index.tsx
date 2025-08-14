import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadPageTreeNode, LoadPageTreeNodeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadPageTreeNode(args.params as LoadPageTreeNodeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
