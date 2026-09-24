# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `memory/memory-backend.ts`: `MemoryBackend` implementa `PlayerAccounts`, `GameBoard` ed `EveningAdmin`
  tenendo i dati nel browser (`localStorage`). Serve per sviluppare e provare le schermate
  finché non c'è Supabase: NON condivide dati tra telefoni. Simula la latenza di rete e
  crea alcuni giocatori finti se il database è vuoto. Riconosce l'admin dalle credenziali
  ricevute in `options.admin` e riserva quel nickname.
- `default-catalog.ts`: la lista di azioni predefinita (lo stato iniziale della serata).
- `browser/safe-storage.ts`: accesso a `localStorage` che non esplode in navigazione privata;
  `inMemoryStorage` per i test.
- `browser/storage-session-store.ts`: `SessionStore` sul token salvato.
- `browser/vibration-haptics.ts`: `Haptics` con la Vibration API (su iOS non fa nulla).

## Relazioni
- Dipende da: `application/` (porte), `domain/`.
- Usato da: `app/compose.ts` soltanto.
- Dati posseduti: chiavi `fantalaurea:memory-db:v2` e `fantalaurea:session-token` in `localStorage`.
- Pubblica: le notifiche di `GameBoard.onChange` a ogni scrittura (contatori, giocatori, lista).

## In arrivo
L'adapter Supabase affiancherà `MemoryBackend` con gli stessi contratti; la scelta avverrà in
`app/compose.ts`.
