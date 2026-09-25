# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`: `Action` (titolo, descrizione, tipo, punti con segno, `photoPolicy`,
  `difficulty`), `ActionDraft` + `validateActionDraft` (titolo 2-40, descrizione 3-300, punti
  interi 0-1000 senza segno: il segno lo decide il tipo, ADR 0010), `isSharedByEveryone`,
  `acceptsPhoto`, `pointsMagnitude`.
- `completion.ts`: `Completion` (id per i like, azione, ora, foto, chi l'ha segnata),
  `isDone`, `isOwnedBy`, `effectOfDeletingPhoto` (togliere una foto obbligatoria annulla
  l'azione).
- `evening.ts`: `JoinRequest` (parola segreta + identità + `RealNameResolution`: `ask`,
  `takeover` del profilo esistente o `distinct`), `AccessLogEntry`.
- `feed.ts`: `FeedItem` = `PostItem` | `CompletionItem`, `LikeSummary`, `Liker`, `mergeFeed`
  (più recenti prima, la copia più fresca vince), `withLike`, `isValidCaption` (300 caratteri).
- `profile.ts`: `Profile` con completamenti e post, `photosOf` (tutte le foto di un giocatore),
  `isValidBio` (500 caratteri).
- `player.ts`: `Player`, `Participant` (con foto profilo, azioni, punti), `Session` =
  `PlayerSession` | `AdminSession`, `validateIdentity`, `sameName`, `rankParticipants` (punti,
  poi azioni, poi nickname).
- `text.ts`: `normalizeText`. `result.ts`: `Result<T, E>` con `ok` / `err`.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

Le stesse regole sono applicate anche dal database (`supabase/migrations`), che resta
l'autorità finale: il dominio serve a rispondere subito e a spiegarle nell'interfaccia.
