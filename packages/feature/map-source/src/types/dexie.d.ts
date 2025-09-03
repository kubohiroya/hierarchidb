declare module 'dexie' {
  export type Table<T, Key> = {
    toArray(): Promise<T[]>;
  };

  export default class Dexie {
    constructor(name: string);
    version(v: number): { stores(schema: Record<string, string>): void };
  }
}

