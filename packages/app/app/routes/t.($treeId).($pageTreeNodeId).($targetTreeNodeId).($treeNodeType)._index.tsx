import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTreeNodeType, LoadTreeNodeTypeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeType(args.params as LoadTreeNodeTypeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
