import type { LoaderFunctionArgs } from 'react-router';
import { loadNodeAction, LoadNodeActionArgs } from '~/loader';
import { PluginDialogRoute } from '@hierarchidb/runtime-ui-plugin-dialog';

export async function clientLoader(args: LoaderFunctionArgs) {
  try { console.log('[Route] action route clientLoader params:', args.params); } catch {}
  const data = await loadNodeAction(args.params as LoadNodeActionArgs);
  return data;
}

export default PluginDialogRoute;
