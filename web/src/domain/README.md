# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`: `Action`, `ActionKind` (`bonus` | `malus` | `common`), `isSharedByEveryone`,
  `ActionDraft` + `validateActionDraft` (descrizione di 3-200 caratteri) per le azioni nuove.
- `counts.ts`: `ActionCounts`, `Step`, `countOf`, `withCount`, `nextCount` (mai sotto zero),
  `isValidCount`, `totalActions`.
- `player.ts`: `Player`, `Participant`, `Identity`; `Session` = `PlayerSession` | `AdminSession`
  (l'admin non ha un `Player`: non può segnare azioni né comparire in classifica); `validateIdentity`
  (normalizza gli spazi, limiti in `IDENTITY_LIMITS`), `sameName` (ignora maiuscole e spazi),
  `rankParticipants` (più azioni prima, poi nickname).
- `text.ts`: `normalizeText` (spazi ai bordi e doppi).
- `result.ts`: `Result<T, E>` con `ok` / `err`, per gli errori previsti senza eccezioni.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

I punti (`Action.points`) esistono nel modello ma non vengono mostrati: decisione dell'utente.
