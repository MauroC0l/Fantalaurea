# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`: `Action`, `ActionKind` (`bonus` | `malus` | `common`), `isSharedByEveryone`.
- `counts.ts`: `ActionCounts`, `Step`, `countOf`, `withCount`, `nextCount` (mai sotto zero),
  `isValidCount`, `totalActions`.
- `player.ts`: `Player`, `Participant`, `Session`, `Identity`, `validateIdentity`
  (normalizza gli spazi, limiti in `IDENTITY_LIMITS`), `sameName` (ignora maiuscole e spazi),
  `rankParticipants` (più azioni prima, poi nickname).
- `result.ts`: `Result<T, E>` con `ok` / `err`, per gli errori previsti senza eccezioni.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

I punti (`Action.points`) esistono nel modello ma non vengono mostrati: decisione dell'utente.
