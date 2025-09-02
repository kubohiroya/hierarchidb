import type { EntityHandler } from './EntityHandler';

class EntityRegistry {
  private handlers = new Map<string, EntityHandler>();
  private fallback: EntityHandler | undefined;

  register(nodeType: string, handler: EntityHandler): void {
    this.handlers.set(nodeType, handler);
  }

  setFallback(handler: EntityHandler): void {
    this.fallback = handler;
  }

  get(nodeType: string): EntityHandler | undefined {
    return this.handlers.get(nodeType) || this.fallback;
  }
}

export const entityRegistry = new EntityRegistry();

