export interface DualKeyMapEntry<PrimaryKey extends PropertyKey, SecondaryKey extends PropertyKey, Value> {
  readonly primaryKey: PrimaryKey;
  readonly secondaryKey: SecondaryKey;
  readonly value: Value;
}

/**
 * DualKeyMap keeps a primary unique key → value mapping alongside a secondary index.
 * The secondary index stores the set of primary keys for a given secondary key, allowing
 * efficient inverse lookups such as "all node IDs that share the same parent".
 */
export class DualKeyMap<PrimaryKey extends PropertyKey, SecondaryKey extends PropertyKey, Value> implements Iterable<DualKeyMapEntry<PrimaryKey, SecondaryKey, Value>> {
  private readonly primaryMap = new Map<PrimaryKey, { value: Value; secondaryKey: SecondaryKey }>();
  private readonly secondaryIndex = new Map<SecondaryKey, Set<PrimaryKey>>();

  /** Number of primary entries currently stored. */
  get size(): number {
    return this.primaryMap.size;
  }

  /**
   * Store or update an entry. If the primary key already exists, the previous secondary
   * key association is removed before the new one is registered.
   */
  set(primaryKey: PrimaryKey, value: Value, secondaryKey: SecondaryKey): this {
    const existing = this.primaryMap.get(primaryKey);
    if (existing) {
      if (existing.secondaryKey !== secondaryKey) {
        this.detachFromSecondary(primaryKey, existing.secondaryKey);
      }
    }

    this.primaryMap.set(primaryKey, { value, secondaryKey });
    this.attachToSecondary(primaryKey, secondaryKey);
    return this;
  }

  /** Retrieve the value for a primary key. */
  get(primaryKey: PrimaryKey): Value | undefined {
    return this.primaryMap.get(primaryKey)?.value;
  }

  /** Retrieve the secondary key currently associated with the primary key. */
  getSecondaryKey(primaryKey: PrimaryKey): SecondaryKey | undefined {
    return this.primaryMap.get(primaryKey)?.secondaryKey;
  }

  /** Determine whether a primary entry exists. */
  hasPrimary(primaryKey: PrimaryKey): boolean {
    return this.primaryMap.has(primaryKey);
  }

  /** Determine whether the secondary index contains at least one primary key for the given secondary key. */
  hasSecondary(secondaryKey: SecondaryKey): boolean {
    const set = this.secondaryIndex.get(secondaryKey);
    return !!set && set.size > 0;
  }

  /**
   * Return the primary keys registered under a secondary key. A new Set is returned to keep
   * internal state encapsulated.
   */
  getPrimaryKeysBySecondary(secondaryKey: SecondaryKey): ReadonlySet<PrimaryKey> {
    const set = this.secondaryIndex.get(secondaryKey);
    return set ? new Set(set) : new Set();
  }

  /** Return the values that share the provided secondary key. */
  getValuesBySecondary(secondaryKey: SecondaryKey): Value[] {
    const keys = this.secondaryIndex.get(secondaryKey);
    if (!keys) return [];
    const result: Value[] = [];
    keys.forEach((primaryKey) => {
      const entry = this.primaryMap.get(primaryKey);
      if (entry) result.push(entry.value);
    });
    return result;
  }

  /**
   * Remove a primary entry and unregister it from the secondary index.
   * Returns true when a value was removed.
   */
  delete(primaryKey: PrimaryKey): boolean {
    const existing = this.primaryMap.get(primaryKey);
    if (!existing) return false;

    this.primaryMap.delete(primaryKey);
    this.detachFromSecondary(primaryKey, existing.secondaryKey);
    return true;
  }

  /** Remove all entries from both maps. */
  clear(): void {
    this.primaryMap.clear();
    this.secondaryIndex.clear();
  }

  /** Iterate over primary entries in insertion order. */
  entries(): IterableIterator<DualKeyMapEntry<PrimaryKey, SecondaryKey, Value>> {
    const iterator = this.primaryMap.entries();
    return {
      [Symbol.iterator]() {
        return this;
      },
      next: (): IteratorResult<DualKeyMapEntry<PrimaryKey, SecondaryKey, Value>> => {
        const { value, done } = iterator.next();
        if (done) {
          return { done: true, value: undefined } as IteratorResult<DualKeyMapEntry<PrimaryKey, SecondaryKey, Value>>;
        }
        const [primaryKey, payload] = value;
        return {
          done: false,
          value: {
            primaryKey,
            secondaryKey: payload.secondaryKey,
            value: payload.value,
          },
        };
      },
    };
  }

  /** Iterate over primary keys. */
  keys(): IterableIterator<PrimaryKey> {
    return this.primaryMap.keys();
  }

  /** Iterate over stored values. */
  values(): IterableIterator<Value> {
    return (function* (map: Map<PrimaryKey, { value: Value }>) {
      for (const { value } of map.values()) {
        yield value;
      }
    })(this.primaryMap);
  }

  [Symbol.iterator](): IterableIterator<DualKeyMapEntry<PrimaryKey, SecondaryKey, Value>> {
    return this.entries();
  }

  forEach(callback: (value: Value, primaryKey: PrimaryKey, map: this) => void): void {
    for (const [primaryKey, payload] of this.primaryMap.entries()) {
      callback(payload.value, primaryKey, this);
    }
  }

  /** Create a shallow clone of the map (values are not cloned). */
  clone(): DualKeyMap<PrimaryKey, SecondaryKey, Value> {
    const next = new DualKeyMap<PrimaryKey, SecondaryKey, Value>();
    this.primaryMap.forEach(({ value, secondaryKey }, primaryKey) => {
      next.set(primaryKey, value, secondaryKey);
    });
    return next;
  }

  private attachToSecondary(primaryKey: PrimaryKey, secondaryKey: SecondaryKey): void {
    let set = this.secondaryIndex.get(secondaryKey);
    if (!set) {
      set = new Set<PrimaryKey>();
      this.secondaryIndex.set(secondaryKey, set);
    }
    set.add(primaryKey);
  }

  private detachFromSecondary(primaryKey: PrimaryKey, secondaryKey: SecondaryKey): void {
    const set = this.secondaryIndex.get(secondaryKey);
    if (!set) return;
    set.delete(primaryKey);
    if (set.size === 0) {
      this.secondaryIndex.delete(secondaryKey);
    }
  }
}
