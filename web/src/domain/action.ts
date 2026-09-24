import { normalizeText } from './text';
import { err, ok, type Result } from './result';

export type ActionKind = 'bonus' | 'malus' | 'common';

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly points: number;
  readonly kind: ActionKind;
}

export interface ActionDraft {
  readonly label: string;
  readonly kind: ActionKind;
}

export type ActionDraftError = 'too-short' | 'too-long';

export const ACTION_LABEL_LIMITS = { min: 3, max: 200 } as const;

export function isSharedByEveryone(action: Action): boolean {
  return action.kind === 'common';
}

export function validateActionDraft(raw: ActionDraft): Result<ActionDraft, ActionDraftError> {
  const label = normalizeText(raw.label);
  const length = [...label].length;
  if (length < ACTION_LABEL_LIMITS.min) return err('too-short');
  if (length > ACTION_LABEL_LIMITS.max) return err('too-long');
  return ok({ label, kind: raw.kind });
}
