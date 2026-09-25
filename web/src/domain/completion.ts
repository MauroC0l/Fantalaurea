import type { Action } from './action';

/** An action done by the player, or a shared action done by anyone. */
export interface Completion {
  /** Likes point here. */
  readonly id: string;
  readonly actionId: string;
  readonly completedAt: Date;
  readonly photoId: string | null;
  readonly by: { readonly id: string; readonly nickname: string };
}

export type Completions = ReadonlyMap<string, Completion>;

export function isDone(completions: Completions, action: Action): boolean {
  return completions.has(action.id);
}

/** Shared actions can be undone, or their photo changed, only by whoever marked them. */
export function isOwnedBy(completion: Completion, playerId: string): boolean {
  return completion.by.id === playerId;
}

export interface PhotoDeletionEffect {
  readonly undoesAction: boolean;
}

/** A required photo cannot exist without its completion, so removing it undoes the action. */
export function effectOfDeletingPhoto(action: Action): PhotoDeletionEffect {
  return { undoesAction: action.photoPolicy === 'required' };
}
