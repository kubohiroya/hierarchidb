import { Outlet, useLoaderData } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadTree, LoadTreeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();

  return (
    <div>
      <h1>t.($treeId)._layout</h1>
      <ul>
        <li>{data.tree?.treeId}</li>
        <li>{data.tree?.name}</li>
      </ul>
      <Outlet />
    </div>
  );
}
