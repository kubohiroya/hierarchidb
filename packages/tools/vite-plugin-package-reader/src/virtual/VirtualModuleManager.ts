import type { VirtualModuleGenerator } from '../types.js';
import { Logger } from '../core/Logger.js';

interface VirtualModule {
  id: string;
  resolvedId: string;
  content: string;
  types?: string;
}

export class VirtualModuleManager {
  private modules = new Map<string, VirtualModule>();
  private generators = new Map<string, VirtualModuleGenerator>();
  private logger: Logger;
  private prefix = '\0virtual:';

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
      * Virtual Module
      */
  register<T>(generator: VirtualModuleGenerator<T>): void {
    const moduleId = this.normalizeModuleId(generator.moduleId);
    this.generators.set(moduleId, generator);
    this.logger.debug(`Registered virtual module: ${moduleId}`);
  }

  /**
      * Virtual Module
      */
  async generate<T>(data: T): Promise<void> {
    for (const [moduleId, generator] of this.generators) {
      try {
        const content = await generator.generate(data);
        const types = generator.generateTypes ? await generator.generateTypes(data) : undefined;

        this.modules.set(moduleId, {
          id: moduleId,
          resolvedId: this.prefix + moduleId,
          content,
          types,
        });

        this.logger.debug(`Generated virtual module: ${moduleId}`);
      } catch (error) {
        this.logger.error(`Failed to generate virtual module ${moduleId}:`, error);
        throw error;
      }
    }
  }

  /**
      * ViteresolveId
      */
  resolveId(id: string): string | null {
    const normalizedId = this.normalizeModuleId(id);

    //  virtual:
    if (id.startsWith('virtual:')) {
      if (this.modules.has(normalizedId)) {
        return this.prefix + normalizedId;
      }
    }

    if (this.modules.has(id)) {
      return this.prefix + id;
    }

    return null;
  }

  /**
      * Viteload
      */
  load(id: string): string | null {
    //  \0virtual:
    if (id.startsWith(this.prefix)) {
      const moduleId = id.slice(this.prefix.length);
      const module = this.modules.get(moduleId);
      if (module) {
        this.logger.debug(`Loading virtual module: ${moduleId}`);
        return module.content;
      }
    }

    return null;
  }

  /**
      * TypeScript
      */
  getTypes(moduleId: string): string | undefined {
    const normalizedId = this.normalizeModuleId(moduleId);
    const module = this.modules.get(normalizedId);
    return module?.types;
  }

  /**
      * Virtual Module ID
      */
  getModuleIds(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
      * Virtual Module
      */
  getModuleContent(moduleId: string): string | undefined {
    const normalizedId = this.normalizeModuleId(moduleId);
    return this.modules.get(normalizedId)?.content;
  }

  /**
      * Virtual Module
      */
  clear(): void {
    this.modules.clear();
    this.logger.debug('Cleared all virtual modules');
  }

  /**
      * Virtual Module
      */
  remove(moduleId: string): boolean {
    const normalizedId = this.normalizeModuleId(moduleId);
    const result = this.modules.delete(normalizedId);
    if (result) {
      this.logger.debug(`Removed virtual module: ${normalizedId}`);
    }
    return result;
  }

  /**
      * Virtual Module
      */
  update(moduleId: string, content: string, types?: string): void {
    const normalizedId = this.normalizeModuleId(moduleId);
    const module = this.modules.get(normalizedId);

    if (module) {
      module.content = content;
      if (types !== undefined) {
        module.types = types;
      }
      this.logger.debug(`Updated virtual module: ${normalizedId}`);
    } else {
      this.modules.set(normalizedId, {
        id: normalizedId,
        resolvedId: this.prefix + normalizedId,
        content,
        types,
      });
      this.logger.debug(`Created virtual module: ${normalizedId}`);
    }
  }

  /**
      * Module ID
      */
  private normalizeModuleId(id: string): string {
    //  virtual:
    if (id.startsWith('virtual:')) {
      return id.slice('virtual:'.length);
    }
    //  \0virtual:
    if (id.startsWith(this.prefix)) {
      return id.slice(this.prefix.length);
    }
    return id;
  }

  /**
      * HMR:
      */
  hasChanged(moduleId: string, newContent: string): boolean {
    const normalizedId = this.normalizeModuleId(moduleId);
    const module = this.modules.get(normalizedId);
    return !module || module.content !== newContent;
  }
}