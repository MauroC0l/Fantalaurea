export interface KeyValueStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/** localStorage can throw (private browsing, blocked cookies): degrade to "nothing saved". */
export function browserStorage(): KeyValueStorage {
  return {
    read: (key) => attempt(() => localStorage.getItem(key), null),
    write: (key, value) => attempt(() => localStorage.setItem(key, value), undefined),
    remove: (key) => attempt(() => localStorage.removeItem(key), undefined),
  };
}

export function inMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

function attempt<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    return fallback;
  }
}
