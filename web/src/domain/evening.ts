import type { Identity } from './player';

/**
 * How to treat a new nickname whose real name already belongs to someone:
 * - `ask`: stop and ask the person (default);
 * - `takeover`: that profile is theirs, it gets the new nickname and keeps everything;
 * - `distinct`: they are another person with the same real name.
 */
export type RealNameResolution =
  | { readonly kind: 'ask' }
  | { readonly kind: 'takeover'; readonly playerId: string }
  | { readonly kind: 'distinct' };

export interface JoinRequest {
  readonly secretWord: string;
  readonly identity: Identity;
  readonly resolution: RealNameResolution;
}

export interface AccessLogEntry {
  readonly at: Date;
  readonly device: string;
}
