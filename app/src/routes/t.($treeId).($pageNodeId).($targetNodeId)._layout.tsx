import type { LoaderFunctionArgs } from 'react-router';
import { Outlet } from 'react-router';
import { loadTargetNode, LoadTargetNodeArgs } from '~/loader';

export async function clientLoader(args: LoaderFunctionArgs) {
  // Don't load if targetNodeId is undefined
  if (!args.params.targetNodeId || !args.params.targetNodeId) {
    return null;
  }
  return await loadTargetNode(args.params as LoadTargetNodeArgs);
}

export default function TLayout() {

  return <Outlet />;
}
