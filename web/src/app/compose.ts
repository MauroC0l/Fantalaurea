import type { EveningAdmin, GameBoard, Haptics, PlayerAccounts, SessionStore } from '../application/ports';
import { browserStorage, type KeyValueStorage } from '../infrastructure/browser/safe-storage';
import { storageSessionStore } from '../infrastructure/browser/storage-session-store';
import { vibrationHaptics } from '../infrastructure/browser/vibration-haptics';
import { DEFAULT_CATALOG } from '../infrastructure/default-catalog';
import { MemoryBackend } from '../infrastructure/memory/memory-backend';
import { SupabaseBackend } from '../infrastructure/supabase/supabase-backend';

export interface AppDependencies {
  readonly accounts: PlayerAccounts;
  readonly board: GameBoard;
  readonly admin: EveningAdmin;
  readonly sessions: SessionStore;
  readonly haptics: Haptics;
}

type Backend = PlayerAccounts & GameBoard & EveningAdmin;

// Only for the in-browser backend: with Supabase the credentials live in the database.
const DEV_ADMIN = { nickname: 'Administrator', realName: 'admin' };

const DEMO_PLAYERS = [
  { nickname: 'Shottino Selvaggio', realName: 'Giulia Bianchi' },
  { nickname: 'Er Verticale', realName: 'Luca Verdi' },
  { nickname: 'Clash Royale Addicted', realName: 'Sara Neri' },
];

/** The only place that knows which implementations are in use. */
export function composeApp(): AppDependencies {
  const storage = browserStorage();
  const backend = chooseBackend(storage);
  return {
    accounts: backend,
    board: backend,
    admin: backend,
    sessions: storageSessionStore(storage),
    haptics: vibrationHaptics(),
  };
}

function chooseBackend(storage: KeyValueStorage): Backend {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (url && key) return new SupabaseBackend(url, key, { notifyDebounceMs: 300 });
  return new MemoryBackend(DEFAULT_CATALOG, storage, {
    latencyMs: 250,
    admin: DEV_ADMIN,
    demoPlayers: DEMO_PLAYERS,
  });
}
