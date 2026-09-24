import { validateActionDraft, type ActionDraft, type ActionDraftError } from '../domain/action';
import type { AdminSession } from '../domain/player';
import { err, ok, type Result } from '../domain/result';
import type { EveningAdmin, UpdateActionFailure } from './ports';

export type ActionTarget = { readonly kind: 'new' } | { readonly kind: 'existing'; readonly id: string };

export type SaveActionError =
  | { readonly kind: 'invalid'; readonly errors: readonly ActionDraftError[] }
  | { readonly kind: UpdateActionFailure };

export async function saveAction(
  admin: EveningAdmin,
  session: AdminSession,
  target: ActionTarget,
  raw: ActionDraft,
): Promise<Result<void, SaveActionError>> {
  const validated = validateActionDraft(raw);
  if (!validated.ok) return err({ kind: 'invalid', errors: validated.error });

  const saved =
    target.kind === 'new'
      ? await admin.addAction(session, validated.value)
      : await admin.updateAction(session, target.id, validated.value);
  return saved.ok ? ok(undefined) : err({ kind: saved.error });
}
