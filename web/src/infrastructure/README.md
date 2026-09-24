# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `supabase/supabase-backend.ts`: `SupabaseBackend` implementa `PlayerAccounts`,
  `GameBoard`, `PlayerMoves` ed `EveningAdmin`.
  - Operazioni senza file: funzioni RPC del database.
  - Tutto ciò che tocca le foto: Edge Function `photos` (ADR 0008). I link alle foto
    arrivano senza host e l'adapter li completa con l'URL di Supabase.
  - `onChange` ascolta Realtime su `actions`, `players`, `player_completions`,
    `shared_completions` e il ritorno in primo piano del telefono; raggruppa gli avvisi
    vicini (300 ms).
- `supabase/supabase-backend.db-test.ts`: test d'integrazione contro lo stack locale
  (`npm run test:db`, AZZERA la serata locale).
- `browser/canvas-photo-processor.ts`: decodifica la foto (anche HEIC su Safari), corregge
  l'orientamento e la ricodifica in JPEG: 2560 px / qualità 0,9 e miniatura 480 px (i valori
  sono in `app/compose.ts`).
- `browser/browser-photo-exporter.ts`: condivisione (Web Share API), download singolo e ZIP
  (libreria `fflate`, senza ricompressione).
- `browser/safe-storage.ts`, `browser/storage-session-store.ts`: token in `localStorage`,
  senza errori in navigazione privata.
- `browser/vibration-haptics.ts`: Vibration API (su iOS non fa nulla).

## Relazioni
- Dipende da: `application/` (porte), `domain/`, `@supabase/supabase-js`, `fflate`, lo schema
  in `supabase/`.
- Usato da: `app/compose.ts` soltanto.
- Dati posseduti: la chiave `fantalaurea:session-token` in `localStorage`.
- Pubblica: le notifiche di `GameBoard.onChange`.
