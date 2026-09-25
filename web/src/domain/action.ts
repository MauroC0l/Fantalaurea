import { err, ok, type Result } from './result';
import { normalizeText } from './text';

export type ActionKind = 'bonus' | 'malus' | 'common';

export type PhotoPolicy = 'none' | 'optional' | 'required';

export type Difficulty = 'soft' | 'medium' | 'hard';

export interface Action {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Signed: negative for a malus. */
  readonly points: number;
  readonly kind: ActionKind;
  readonly photoPolicy: PhotoPolicy;
  readonly difficulty: Difficulty;
}

export interface ActionDraft {
  readonly title: string;
  readonly description: string;
  readonly kind: ActionKind;
  readonly photoPolicy: PhotoPolicy;
  readonly difficulty: Difficulty;
  /** Always positive: the kind decides the sign (a malus costs points). */
  readonly points: number;
}

export type ActionTextField = 'title' | 'description';

export type ActionDraftError =
  | { readonly field: ActionTextField; readonly reason: 'too-short' | 'too-long' }
  | { readonly field: 'points'; readonly reason: 'out-of-range' };

export const ACTION_TEXT_LIMITS: Readonly<Record<ActionTextField, { min: number; max: number }>> = {
  title: { min: 2, max: 40 },
  description: { min: 3, max: 300 },
};

export const MAX_POINTS = 1000;

export function isSharedByEveryone(action: Action): boolean {
  return action.kind === 'common';
}

export function acceptsPhoto(action: Action): boolean {
  return action.photoPolicy !== 'none';
}

/** What the admin types in the editor for an existing action. */
export function pointsMagnitude(action: Action): number {
  return Math.abs(action.points);
}

export function validateActionDraft(raw: ActionDraft): Result<ActionDraft, readonly ActionDraftError[]> {
  const draft: ActionDraft = { ...raw, title: normalizeText(raw.title), description: normalizeText(raw.description) };
  const textErrors = (Object.keys(ACTION_TEXT_LIMITS) as ActionTextField[]).flatMap((field): ActionDraftError[] => {
    const { min, max } = ACTION_TEXT_LIMITS[field];
    const length = [...draft[field]].length;
    if (length < min) return [{ field, reason: 'too-short' }];
    if (length > max) return [{ field, reason: 'too-long' }];
    return [];
  });
  const pointsValid = Number.isInteger(draft.points) && draft.points >= 0 && draft.points <= MAX_POINTS;
  const errors: ActionDraftError[] = pointsValid ? textErrors : [...textErrors, { field: 'points', reason: 'out-of-range' }];
  return errors.length === 0 ? ok(draft) : err(errors);
}
