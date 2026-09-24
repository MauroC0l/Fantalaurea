# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `memory/memory-backend.ts`: `MemoryBackend` implementa `PlayerAccounts`, `GameBoard` ed `EveningAdmin`
  tenendo i dati nel browser (`localStorage`). Serve per sviluppare e provare le schermate
  finché non c'è Supabase: NON condivide dati tra telefoni. Simula la latenza di rete e
  crea alcuni giocatori finti se il database è vuoto. Riconosce l'admin dalle credenziali
  ricevute in `options.admin` e riserva quel nickname.
- `supabase/supabase-backend.ts`: `SupabaseBackend` implementa le stesse tre porte chiamando le
  funzioni RPC del database (vedi `supabase/README.md`). `onChange` ascolta Realtime sulle
  tabelle pubbliche e al ritorno in primo piano del telefono, e raggruppa le notifiche vicine
  (300 ms) per non far ricaricare 50 telefoni a ogni tocco.
- `default-catalog.ts`: la lista di azioni predefinita (lo stato iniziale della serata).
- `browser/safe-storage.ts`: accesso a `localStorage` che non esplode in navigazione privata;
  `inMemoryStorage` per i test.
- `browser/storage-session-store.ts`: `SessionStore` sul token salvato.
- `browser/vibration-haptics.ts`: `Haptics` con la Vibration API (su iOS non fa nulla).

## Relazioni
- Dipende da: `application/` (porte), `domain/`, `@supabase/supabase-js`, lo schema in `supabase/`.
- Usato da: `app/compose.ts` soltanto.
- Dati posseduti: chiavi `fantalaurea:memory-db:v2` e `fantalaurea:session-token` in `localStorage`.
- Pubblica: le notifiche di `GameBoard.onChange` a ogni scrittura (contatori, giocatori, lista).
