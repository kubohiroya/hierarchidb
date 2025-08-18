import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTargetTreeNode, LoadTargetTreeNodeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTargetTreeNode(args.params as LoadTargetTreeNodeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
