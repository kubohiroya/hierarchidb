import type { LoaderFunctionArgs } from 'react-router';
import { useParams } from 'react-router';
import { loadNodeAction, LoadNodeActionArgs } from '~/loader.js';
import { PluginDialogRoute } from '@hierarchidb/runtime-ui-plugin-dialog';
import TrashDialogV2, { clientLoader as trashDialogClientLoader } from '~/components/dialogs/TrashDialogV2.js';

export async function clientLoader(args: LoaderFunctionArgs) {
  const { nodeType } = args.params ?? {};
  if (nodeType === 'trash') {
    return await trashDialogClientLoader(args);
  }
  return await loadNodeAction(args.params as LoadNodeActionArgs);
}

export default function DialogRouteGuarded() {
  const { nodeType, action } = useParams();
  if (nodeType === 'trash') {
    if (!action) return null;
    return <TrashDialogV2 />;
  }
  if (!nodeType || !action) return null;
  return <PluginDialogRoute />;
}
