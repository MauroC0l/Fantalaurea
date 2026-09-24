import type { EveningAdmin, GameBoard, Haptics, PlayerAccounts, SessionStore } from '../application/ports';
import { browserStorage } from '../infrastructure/browser/safe-storage';
import { storageSessionStore } from '../infrastructure/browser/storage-session-store';
import { vibrationHaptics } from '../infrastructure/browser/vibration-haptics';
import { DEFAULT_CATALOG } from '../infrastructure/default-catalog';
import { MemoryBackend } from '../infrastructure/memory/memory-backend';

export interface AppDependencies {
  readonly accounts: PlayerAccounts;
  readonly board: GameBoard;
  readonly admin: EveningAdmin;
  readonly sessions: SessionStore;
  readonly haptics: Haptics;
}

// Chosen by the user; with a real backend they must live only on the server.
const ADMIN_CREDENTIALS = { nickname: 'Administrator', realName: 'admin' };

const DEMO_PLAYERS = [
  { nickname: 'Shottino Selvaggio', realName: 'Giulia Bianchi' },
  { nickname: 'Er Verticale', realName: 'Luca Verdi' },
  { nickname: 'Clash Royale Addicted', realName: 'Sara Neri' },
];

/** The only place that knows which implementations are in use. */
export function composeApp(): AppDependencies {
  const storage = browserStorage();
  const backend = new MemoryBackend(DEFAULT_CATALOG, storage, {
    latencyMs: 250,
    admin: ADMIN_CREDENTIALS,
    demoPlayers: DEMO_PLAYERS,
  });
  return {
    accounts: backend,
    board: backend,
    admin: backend,
    sessions: storageSessionStore(storage),
    haptics: vibrationHaptics(),
  };
}
