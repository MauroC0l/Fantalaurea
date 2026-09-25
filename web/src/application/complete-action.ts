import type { Action } from '../domain/action';
import type { PlayerSession } from '../domain/player';
import { err, type Result } from '../domain/result';
import type { CompleteFailure, PhotoLimitFailure, PhotoProcessor, PlayerMoves } from './ports';

export type CompleteError = CompleteFailure | PhotoLimitFailure | 'unreadable-photo';

export async function completeAction(
  deps: { moves: PlayerMoves; photos: PhotoProcessor },
  session: PlayerSession,
  action: Action,
  file: File | null,
): Promise<Result<void, CompleteError>> {
  if (!file) {
    return action.photoPolicy === 'required' ? err('photo-required') : deps.moves.complete(session, action.id);
  }
  if (action.photoPolicy === 'none') return err('rejected');

  try {
    const prepared = await deps.photos.prepare(file, 'original');
    return deps.moves.completeWithPhoto(session, action.id, prepared);
  } catch {
    return err('unreadable-photo');
  }
}
