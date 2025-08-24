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

  static getSingleton<T>(className: string, factory?: () => T): T {
    if (!this.instances.has(className) && factory) {
      this.instances.set(className, factory());
    }
    return this.instances.get(className) as T;
  }

  static terminate(className: string): void {
    this.instances.delete(className);
  }

  static terminateAll(): void {
    this.instances.clear();
  }
}
