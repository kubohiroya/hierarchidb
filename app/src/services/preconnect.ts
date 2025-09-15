import { getBaseMapDatabase, getResolverDB, getSpreadsheetDatabase, getRouteDatabase, getShapeDatabase, getLocationEphemeralDB } from './databases';

export async function preconnectPluginServices(nodeType: string): Promise<void> {
  try {
    switch (nodeType) {
      case 'basemap': {
        const db = await getBaseMapDatabase();
        await db?.open();
        break;
      }
      case 'resolver': {
        const r = await getResolverDB();
        // resolverDB is often a singleton instance; open() may or may not exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (r as any)?.open?.();
        break;
      }
      case 'spreadsheet': {
        const db = await getSpreadsheetDatabase();
        await db?.open();
        break;
      }
      case 'route': {
        const db = await getRouteDatabase();
        // RouteDatabase may not require explicit open, but call if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)?.open?.();
        break;
      }
      case 'shape': {
        const db = await getShapeDatabase();
        await db?.open();
        break;
      }
      case 'location': {
        const db = await getLocationEphemeralDB();
        await db?.open?.();
        break;
      }
      case 'styler':
      case 'timeline':
      case 'linker':
        // No DB/services to open; keep as no-op preconnect to normalize latency
        break;
      default:
        break;
    }
  } catch {
    // Silently ignore failures; services are optional and should not block UI
  }
}

export async function preconnectForNodeTypes(nodeTypes: Iterable<string>): Promise<void> {
  const uniq = new Set<string>(Array.from(nodeTypes));
  await Promise.all(Array.from(uniq).map(preconnectPluginServices));
  try {
    window.dispatchEvent(new CustomEvent('hdb-services-ready', { detail: { source: 'ui', at: Date.now(), nodeTypes: Array.from(uniq) } }));
  } catch {}
}
