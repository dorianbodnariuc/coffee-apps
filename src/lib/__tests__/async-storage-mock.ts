/**
 * Minimal in-memory AsyncStorage mock for vitest (node has no react-native).
 * Implements only what supabase-js's auth storage adapter uses. Not a test
 * file — a support helper aliased in vitest.config.ts.
 */
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> =>
    store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
  getAllKeys: async (): Promise<string[]> => [...store.keys()],
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    keys.map((key) => [key, store.get(key) ?? null]),
  multiSet: async (pairs: [string, string][]): Promise<void> => {
    for (const [key, value] of pairs) store.set(key, value);
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    for (const key of keys) store.delete(key);
  },
};

export default AsyncStorage;
