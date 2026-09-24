import type { Session } from '../domain/player';
import type { PlayerAccounts, SessionStore } from './ports';

export type ResumeOutcome =
  | { readonly kind: 'resumed'; readonly session: Session }
  | { readonly kind: 'needs-join' }
  | { readonly kind: 'offline' };

export async function resumeSession(deps: {
  accounts: PlayerAccounts;
  sessions: SessionStore;
}): Promise<ResumeOutcome> {
  const token = deps.sessions.read();
  if (token === null) return { kind: 'needs-join' };

  const resumed = await deps.accounts.resume(token);
  if (resumed.ok) return { kind: 'resumed', session: resumed.value };

  // Keep the token when offline: forgetting it would force a new sign-up.
  if (resumed.error === 'unavailable') return { kind: 'offline' };

  deps.sessions.clear();
  return { kind: 'needs-join' };
}
