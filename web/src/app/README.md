# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` (senza, l'app
  non parte) e fissa la qualità delle foto (2560 px / 0,9; miniature 480 px).
- `router.svelte.ts`: `HashRouter` e le rotte `#/regole`, `#/iscrizione`, `#/azioni`,
  `#/partecipanti`, `#/admin`, `#/album` (routing via hash, ADR 0001).
- `../App.svelte`: macchina a stati `booting` → `offline` | `anonymous` | `playing` |
  `administering`, secondo il ruolo della sessione. I giocatori hanno le tab Azioni /
  Partecipanti / Regole, l'admin Azioni / Album. Se il backend non riconosce più la sessione
  dimentica il token e torna alle regole.

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (hash dell'URL).
