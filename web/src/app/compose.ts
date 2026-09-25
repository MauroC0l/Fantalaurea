import type {
  Chat,
  Polls,
  Challenges,
  Clipboard,
  EveningAdmin,
  GameBoard,
  Haptics,
  PhotoExporter,
  PhotoLinkProvider,
  PhotoProcessor,
  PlayerAccounts,
  PlayerMoves,
  SessionStore,
  VoiceRecorder,
} from '../application/ports';
import { browserClipboard } from '../infrastructure/browser/browser-clipboard';
import { browserPhotoExporter } from '../infrastructure/browser/browser-photo-exporter';
import { canvasPhotoProcessor } from '../infrastructure/browser/canvas-photo-processor';
import { browserStorage } from '../infrastructure/browser/safe-storage';
import { storageSessionStore } from '../infrastructure/browser/storage-session-store';
import { browserVoiceRecorder } from '../infrastructure/browser/browser-voice-recorder';
import { vibrationHaptics } from '../infrastructure/browser/vibration-haptics';
import { ChangeSignals } from '../infrastructure/supabase/change-signals';
import { SupabaseBackend } from '../infrastructure/supabase/supabase-backend';
import { SupabaseChat } from '../infrastructure/supabase/supabase-chat';
import { SupabasePolls } from '../infrastructure/supabase/supabase-polls';
import { SupabaseChallenges } from '../infrastructure/supabase/supabase-challenges';
import { createSupabaseClient } from '../infrastructure/supabase/supabase-client';
import { VOICE_MAX_MS } from '../domain/chat';

export interface AppDependencies {
  readonly accounts: PlayerAccounts;
  readonly board: GameBoard;
  readonly moves: PlayerMoves;
  readonly admin: EveningAdmin;
  readonly links: PhotoLinkProvider;
  readonly chat: Chat;
  readonly polls: Polls;
  readonly challenges: Challenges;
  readonly recorder: VoiceRecorder;
  readonly photos: PhotoProcessor;
  readonly exporter: PhotoExporter;
  readonly clipboard: Clipboard;
  readonly sessions: SessionStore;
  readonly haptics: Haptics;
}

// Photos: about 5 megapixels, indistinguishable from the original on a phone (ADR 0008).
// Profile pictures: a 512 px square, enough for a large avatar on retina screens.
const PHOTO_QUALITY = {
  original: { full: { maxEdge: 2560, jpegQuality: 0.9 }, thumbnail: { maxEdge: 720, jpegQuality: 0.78 } },
  square: { full: { maxEdge: 512, jpegQuality: 0.88 }, thumbnail: { maxEdge: 160, jpegQuality: 0.8 } },
} as const;

/** The only place that knows which implementations are in use. */
export function composeApp(): AppDependencies {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY (see web/README.md)');

  const client = createSupabaseClient(url, key);
  const baseUrl = url.replace(/\/$/, '');
  const signals = new ChangeSignals(client, { notifyDebounceMs: 300 });
  const backend = new SupabaseBackend(client, baseUrl, signals);
  return {
    accounts: backend,
    board: backend,
    moves: backend,
    admin: backend,
    links: backend,
    chat: new SupabaseChat(client, baseUrl),
    polls: new SupabasePolls(client, signals),
    challenges: new SupabaseChallenges(client, signals),
    recorder: browserVoiceRecorder(VOICE_MAX_MS),
    photos: canvasPhotoProcessor(PHOTO_QUALITY),
    exporter: browserPhotoExporter(),
    clipboard: browserClipboard(),
    sessions: storageSessionStore(browserStorage()),
    haptics: vibrationHaptics(),
  };
}
