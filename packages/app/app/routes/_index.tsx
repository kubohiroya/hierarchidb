import { Outlet } from 'react-router-dom';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { loadWorkerAPIClient } from '~/loader';

export async function clientLoader(_args: LoaderFunctionArgs) {
  return await loadWorkerAPIClient();
}

export default function TLayout() {
  return (
    <div>
      <h1>[_index]</h1>
      <Outlet />
    </div>
  );
}
