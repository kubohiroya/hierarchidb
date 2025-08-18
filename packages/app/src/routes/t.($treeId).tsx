import type { LoaderFunctionArgs } from 'react-router-dom';
import { Outlet, useLoaderData } from 'react-router-dom';
import { loadTree, LoadTreeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTree(args.params as LoadTreeArgs);
}

const appName = import.meta.env.VITE_APP_NAME;

export default function TLayout() {
  const data = useLoaderData<Awaited<ReturnType<typeof clientLoader>>>();

  return (
    <div>
      <h1>t.($treeId):{appName}</h1>
      <ul>
        <li>{data.tree?.treeId}</li>
        <li>{data.tree?.name}</li>
      </ul>
      <Outlet />
    </div>
  );
}
