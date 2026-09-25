# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`:
  - `Action` (titolo, descrizione, tipo, punti con segno, `photoPolicy`, `difficulty`);
  - `ActionKind` (`bonus` | `malus` | `common`), `PhotoPolicy` (`none` | `optional` | `required`),
    `Difficulty` (`soft` | `medium` | `hard`);
  - `ActionDraft` + `validateActionDraft` (titolo 2-40, descrizione 3-300 caratteri, punti interi
    0-1000 senza segno: il segno lo decide il tipo, ADR 0010);
  - `isSharedByEveryone`, `acceptsPhoto`, `pointsMagnitude`.
- `completion.ts`:
  - `Completion` (azione fatta: quando, da chi, se ha foto), `Completions`;
  - `isDone`, `isOwnedBy` (un'azione condivisa la cambia solo chi l'ha segnata);
  - `effectOfDeletingPhoto`: togliere una foto obbligatoria annulla l'azione.
- `player.ts`: `Player`, `Participant`, `Identity`; `Session` = `PlayerSession` | `AdminSession`
  (l'admin non ha un `Player`); `validateIdentity`, `sameName`, `rankParticipants` (punti, poi azioni, poi nickname).
- `text.ts`: `normalizeText`. `result.ts`: `Result<T, E>` con `ok` / `err`.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

Le stesse regole sono applicate anche dal database (`supabase/migrations`), che resta
l'autorità finale: il dominio serve a rispondere subito e a spiegarle nell'interfaccia.
