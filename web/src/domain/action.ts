import { err, ok, type Result } from './result';
import { normalizeText } from './text';

export type ActionKind = 'bonus' | 'malus' | 'common';

export type PhotoPolicy = 'none' | 'optional' | 'required';

export interface Action {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly points: number;
  readonly kind: ActionKind;
  readonly photoPolicy: PhotoPolicy;
}

export interface ActionDraft {
  readonly title: string;
  readonly description: string;
  readonly kind: ActionKind;
  readonly photoPolicy: PhotoPolicy;
}

export type ActionTextField = 'title' | 'description';

export interface ActionDraftError {
  readonly field: ActionTextField;
  readonly reason: 'too-short' | 'too-long';
}

export const ACTION_TEXT_LIMITS: Readonly<Record<ActionTextField, { min: number; max: number }>> = {
  title: { min: 2, max: 40 },
  description: { min: 3, max: 300 },
};

export function isSharedByEveryone(action: Action): boolean {
  return action.kind === 'common';
}

export function acceptsPhoto(action: Action): boolean {
  return action.photoPolicy !== 'none';
}

export function validateActionDraft(raw: ActionDraft): Result<ActionDraft, readonly ActionDraftError[]> {
  const draft: ActionDraft = { ...raw, title: normalizeText(raw.title), description: normalizeText(raw.description) };
  const errors = (Object.keys(ACTION_TEXT_LIMITS) as ActionTextField[]).flatMap((field): ActionDraftError[] => {
    const { min, max } = ACTION_TEXT_LIMITS[field];
    const length = [...draft[field]].length;
    if (length < min) return [{ field, reason: 'too-short' }];
    if (length > max) return [{ field, reason: 'too-long' }];
    return [];
  });
  return errors.length === 0 ? ok(draft) : err(errors);
}
