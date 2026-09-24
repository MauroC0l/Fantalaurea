# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Oggi usa `MemoryBackend`.
- `router.svelte.ts`: `HashRouter` e le rotte `#/regole`, `#/iscrizione`, `#/azioni`,
  `#/partecipanti` (routing via hash, vedi ADR 0001).
- `../App.svelte`: macchina a stati dell'app, `booting` → `offline` | `anonymous` |
  `playing`. Da anonimo mostra regole e iscrizione; in gioco mostra tab bar e schermate. Se
  il backend non riconosce più il giocatore (`unauthorized`) dimentica il token e torna
  all'iscrizione.

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (hash dell'URL).
