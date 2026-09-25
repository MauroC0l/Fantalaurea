# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` e fissa la
  qualità delle foto.
- `router.svelte.ts`: `HashRouter`, che trasforma l'URL in un `Route` (definito in
  `features/routes.ts`): `#/regole`, `#/parola`, `#/iscrizione`, `#/bacheca`, `#/azioni`,
  `#/classifica`, `#/profilo`, `#/giocatore/<id>`, `#/admin`, `#/album`, `#/serata`.
- `../App.svelte`: macchina a stati `booting` → `offline` | `anonymous` (con la parola già
  data, `''` per l'admin, o nessuna) | `playing` | `administering`. Crea gli stati di partita,
  bacheca, profilo e la cache dei link foto, mostra la tab bar giusta per il ruolo e la
  conferma di uscita. Una sessione scaduta riporta alle regole con un avviso.

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (hash dell'URL).
