import { validateActionDraft, type Action, type ActionDraft, type ActionDraftError } from '../domain/action';
import type { AdminSession } from '../domain/player';
import { err, type Result } from '../domain/result';
import type { EveningAdmin, WriteFailure } from './ports';

export type AddActionError =
  | { readonly kind: 'invalid'; readonly reason: ActionDraftError }
  | { readonly kind: WriteFailure };

export async function addAction(
  admin: EveningAdmin,
  session: AdminSession,
  raw: ActionDraft,
): Promise<Result<Action, AddActionError>> {
  const validated = validateActionDraft(raw);
  if (!validated.ok) return err({ kind: 'invalid', reason: validated.error });

  const added = await admin.addAction(session, validated.value);
  return added.ok ? added : err({ kind: added.error });
}
