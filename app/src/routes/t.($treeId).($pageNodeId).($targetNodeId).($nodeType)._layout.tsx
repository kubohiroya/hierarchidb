import { Outlet } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { loadNodeType, LoadNodeTypeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadNodeType(args.params as LoadNodeTypeArgs);
}

export default function TLayout() {
  return <Outlet />;
}
