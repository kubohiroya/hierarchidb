import type { LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { loadWorkerAPIClient } from '~/loader.js';

export async function clientLoader(_args: LoaderFunctionArgs) {
  return await loadWorkerAPIClient();
}

export default function TLayout() {
  return <Outlet />;
}
