import { Outlet, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { loadTree, LoadTreeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();

  return <Outlet />;
}
