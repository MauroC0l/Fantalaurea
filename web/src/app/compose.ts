import type {
  EveningAdmin,
  GameBoard,
  Haptics,
  PhotoExporter,
  PhotoProcessor,
  PlayerAccounts,
  PlayerMoves,
  SessionStore,
} from '../application/ports';
import { browserPhotoExporter } from '../infrastructure/browser/browser-photo-exporter';
import { canvasPhotoProcessor } from '../infrastructure/browser/canvas-photo-processor';
import { browserStorage } from '../infrastructure/browser/safe-storage';
import { storageSessionStore } from '../infrastructure/browser/storage-session-store';
import { vibrationHaptics } from '../infrastructure/browser/vibration-haptics';
import { SupabaseBackend } from '../infrastructure/supabase/supabase-backend';

export interface AppDependencies {
  readonly accounts: PlayerAccounts;
  readonly board: GameBoard;
  readonly moves: PlayerMoves;
  readonly admin: EveningAdmin;
  readonly photos: PhotoProcessor;
  readonly exporter: PhotoExporter;
  readonly sessions: SessionStore;
  readonly haptics: Haptics;
}

// About 5 megapixels: indistinguishable from the original on a phone or on social media (ADR 0008).
const FULL_PHOTO = { maxEdge: 2560, jpegQuality: 0.9 };
const THUMBNAIL = { maxEdge: 480, jpegQuality: 0.78 };

/** The only place that knows which implementations are in use. */
export function composeApp(): AppDependencies {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY (see web/README.md)');

  const backend = new SupabaseBackend(url, key, { notifyDebounceMs: 300 });
  const storage = browserStorage();
  return {
    accounts: backend,
    board: backend,
    moves: backend,
    admin: backend,
    photos: canvasPhotoProcessor(FULL_PHOTO, THUMBNAIL),
    exporter: browserPhotoExporter(),
    sessions: storageSessionStore(storage),
    haptics: vibrationHaptics(),
  };
}
