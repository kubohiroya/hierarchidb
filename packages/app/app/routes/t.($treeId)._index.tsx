import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTree, LoadTreeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
