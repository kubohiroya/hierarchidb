/**
 * Linker Plugin - Services entry (placeholder)
 */
export type LinkerResource = {
  id: string;
  name: string;
  type: 'shape' | 'route' | 'basemap' | 'resolver' | 'raster' | 'tilejson' | 'other';
  url?: string;
  meta?: Record<string, unknown>;
};

export class LinkerResourceService {
  private store = new Map<string, LinkerResource>();

  add(resource: Omit<LinkerResource, 'id'> & { id?: string }): LinkerResource {
    const id = resource.id || crypto.randomUUID();
    const full: LinkerResource = { ...resource, id } as LinkerResource;
    this.store.set(id, full);
    return full;
  }

  remove(id: string): boolean {
    return this.store.delete(id);
  }

  get(id: string): LinkerResource | undefined {
    return this.store.get(id);
  }

  list(): LinkerResource[] {
    return Array.from(this.store.values());
  }
}

export const linkerServices = {
  LinkerResourceService,
};

export default linkerServices;
