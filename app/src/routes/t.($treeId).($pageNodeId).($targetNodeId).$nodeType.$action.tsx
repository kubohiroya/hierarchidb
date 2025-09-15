import type { LoaderFunctionArgs } from 'react-router';
import { useParams } from 'react-router';
import { loadNodeAction, LoadNodeActionArgs } from '~/loader';
import { PluginDialogRoute } from '@hierarchidb/runtime-ui-plugin-dialog';

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadNodeAction(args.params as LoadNodeActionArgs);
}

export default function DialogRouteGuarded() {
  const { nodeType, action } = useParams();
  if (!nodeType || !action) return null;
  return PluginDialogRoute();
}
