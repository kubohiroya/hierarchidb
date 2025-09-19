import type { LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { loadTree } from '~/loader.js';

type LoaderData = Awaited<ReturnType<typeof loadTree>>;

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { treeId } = params;
  if (!treeId) {
    throw new Response('Missing treeId parameter.', { status: 400 });
  }
  return await loadTree({ treeId });
}

export default function TLayout() {
  void useLoaderData<LoaderData>();

  return <Outlet />;
}
