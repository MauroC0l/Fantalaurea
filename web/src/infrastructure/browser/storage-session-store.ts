import type { SessionStore } from '../../application/ports';
import type { KeyValueStorage } from './safe-storage';

const TOKEN_KEY = 'fantalaurea:session-token';

export function storageSessionStore(storage: KeyValueStorage): SessionStore {
  return {
    read: () => storage.read(TOKEN_KEY),
    write: (token) => storage.write(TOKEN_KEY, token),
    clear: () => storage.remove(TOKEN_KEY),
  };
}
