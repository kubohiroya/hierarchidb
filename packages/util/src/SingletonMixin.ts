/**
 * Singleton mixin for resource worker services
 * Usage:
 *   class MyService {
 *     static getSingleton() {
 *       return SingletonMixin.getSingleton(MyService.name, () => new MyService());
 *     }
 *   }
 */
export class SingletonMixin {
  private static instances = new Map<string, unknown>();
  private static pending = new Map<string, Promise<unknown>>();

  static async getSingleton<T>(className: string, factory?: () => T | Promise<T>): Promise<T> {
    console.log(`[SingletonMixin] getSingleton called for ${className}`);

    // If already instantiated, return it
    if (this.instances.has(className)) {
      console.log(`[SingletonMixin] Returning existing instance for ${className}`);
      return this.instances.get(className) as T;
    }

    // If currently being created, wait for it
    if (this.pending.has(className)) {
      console.log(`[SingletonMixin] Waiting for pending instance of ${className}`);
      return this.pending.get(className) as Promise<T>;
    }

    // Create new instance
    if (factory) {
      console.log(`[SingletonMixin] Creating new instance of ${className}`);
      const promise = Promise.resolve(factory()).then((instance) => {
        console.log(`[SingletonMixin] Instance created for ${className}`);
        this.instances.set(className, instance);
        this.pending.delete(className);
        return instance;
      }).catch((error) => {
        console.error(`[SingletonMixin] Failed to create instance of ${className}:`, error);
        this.pending.delete(className);
        throw error;
      });

      this.pending.set(className, promise);
      return promise;
    }

    throw new Error(`No instance or factory provided for ${className}`);
  }

  static terminate(className: string): void {
    this.instances.delete(className);
  }

  static terminateAll(): void {
    this.instances.clear();
  }
}
