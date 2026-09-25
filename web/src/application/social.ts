import { isValidCaption } from '../domain/feed';
import type { PlayerSession } from '../domain/player';
import { isValidBio } from '../domain/profile';
import { err, type Result } from '../domain/result';
import type { FeatureFailure, PhotoLimitFailure, PhotoProcessor, PlayerMoves, WriteFailure } from './ports';

export type PublishError = FeatureFailure | PhotoLimitFailure | 'caption-too-long' | 'unreadable-photo';

export async function publishPost(
  deps: { moves: PlayerMoves; photos: PhotoProcessor },
  session: PlayerSession,
  file: File,
  caption: string,
): Promise<Result<void, PublishError>> {
  if (!isValidCaption(caption)) return err('caption-too-long');
  try {
    const prepared = await deps.photos.prepare(file, 'original');
    return deps.moves.createPost(session, prepared, caption.trim());
  } catch {
    return err('unreadable-photo');
  }
}

export async function changeAvatar(
  deps: { moves: PlayerMoves; photos: PhotoProcessor },
  session: PlayerSession,
  file: File,
): Promise<Result<void, WriteFailure | 'unreadable-photo'>> {
  try {
    const prepared = await deps.photos.prepare(file, 'square');
    return deps.moves.setAvatar(session, prepared);
  } catch {
    return err('unreadable-photo');
  }
}

export function saveBio(
  moves: PlayerMoves,
  session: PlayerSession,
  bio: string,
): Promise<Result<void, WriteFailure | 'bio-too-long'>> {
  if (!isValidBio(bio)) return Promise.resolve(err('bio-too-long'));
  return moves.updateBio(session, bio.trim());
}
