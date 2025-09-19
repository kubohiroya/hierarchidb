import type { LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { loadTree, LoadTreeArgs } from '~/loader.js';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

export default function TLayout() {
  // const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();

  return <Outlet />;
}
