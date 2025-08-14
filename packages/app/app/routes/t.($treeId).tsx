import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTree, LoadTreeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();

  return (<div>
    <h1>treeId={data.tree?.treeId}</h1>
    <h1>treeName={data.tree?.name}</h1>
    <Outlet /></div>);
}
