import type { JoinRequest } from '../domain/evening';
import { validateIdentity, type IdentityError, type Session } from '../domain/player';
import { err, ok, type Result } from '../domain/result';
import type { JoinFailure, PlayerAccounts, SessionStore } from './ports';

export type JoinError = { readonly kind: 'invalid'; readonly errors: readonly IdentityError[] } | JoinFailure;

export async function joinGame(
  deps: { accounts: PlayerAccounts; sessions: SessionStore },
  request: JoinRequest,
): Promise<Result<Session, JoinError>> {
  const validated = validateIdentity(request.identity);
  if (!validated.ok) return err({ kind: 'invalid', errors: validated.error });

  const joined = await deps.accounts.join({ ...request, identity: validated.value });
  if (!joined.ok) return joined;

  deps.sessions.write(joined.value.token);
  return ok(joined.value);
}
