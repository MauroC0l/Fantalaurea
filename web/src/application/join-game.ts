import { validateIdentity, type Identity, type IdentityError, type Session } from '../domain/player';
import { err, ok, type Result } from '../domain/result';
import type { PlayerAccounts, SessionStore } from './ports';

export type JoinError =
  | { readonly kind: 'invalid'; readonly errors: readonly IdentityError[] }
  | { readonly kind: 'nickname-taken' }
  | { readonly kind: 'unavailable' };

export async function joinGame(
  deps: { accounts: PlayerAccounts; sessions: SessionStore },
  raw: Identity,
): Promise<Result<Session, JoinError>> {
  const validated = validateIdentity(raw);
  if (!validated.ok) return err({ kind: 'invalid', errors: validated.error });

  const joined = await deps.accounts.join(validated.value);
  if (!joined.ok) return err({ kind: joined.error });

  deps.sessions.write(joined.value.token);
  return ok(joined.value);
}
