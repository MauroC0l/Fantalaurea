# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `supabase/supabase-backend.ts`: `SupabaseBackend` implementa `PlayerAccounts`,
  `GameBoard`, `PlayerMoves`, `EveningAdmin` e `PhotoLinkProvider`.
  - Tutte le letture sono funzioni RPC con il token; il codice `28000` diventa
    `SessionExpiredError`.
  - Ciò che tocca i file passa dalla Edge Function `photos` (ADR 0008).
  - I link firmati (12 ore) sono tenuti in una cache: ogni foto si chiede una volta sola.
  - Dopo ogni scrittura riuscita annuncia sul canale broadcast `fantalaurea` quali tabelle
    sono cambiate (via HTTP se il canale non è collegato) e avvisa subito anche le schermate
    di questo telefono (ADR 0013).
  - `onChange` ascolta quel canale, raggruppa i segnali (300 ms) e al ritorno in primo piano
    del telefono segnala tutte le tabelle.
  - Nel log admin invia lo user agent del telefono.
- `supabase/supabase-backend.db-test.ts`: test d'integrazione contro lo stack locale
  (`npm run test:db`, ricrea il database locale).
- `browser/canvas-photo-processor.ts`: decodifica (anche HEIC su Safari), orientamento,
  JPEG. `original`: 2560 px + miniatura 720 px; `square`: ritaglio centrale 512 px +
  miniatura 160 px (valori in `app/compose.ts`).
- `browser/browser-photo-exporter.ts`: condivisione di file e di testo (Web Share API),
  download singolo e ZIP (`fflate`).
- `browser/browser-clipboard.ts`: copia negli appunti.
- `browser/safe-storage.ts`, `browser/storage-session-store.ts`: token in `localStorage`.
- `browser/vibration-haptics.ts`: Vibration API (su iOS non fa nulla).

## Relazioni
- Dipende da: `application/`, `domain/`, `@supabase/supabase-js`, `fflate`, lo schema e la
  funzione in `supabase/`.
- Usato da: `app/compose.ts` soltanto.
- Dati posseduti: la chiave `fantalaurea:session-token` in `localStorage`, la cache dei link.
- Ascolta e pubblica: il canale broadcast `fantalaurea` (solo nomi di tabelle). Pubblica anche
  le notifiche di `GameBoard.onChange`.
