# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Oggi usa `MemoryBackend` e contiene le credenziali admin di
  sviluppo (con il backend reale andranno solo sul server, vedi ADR 0005).
- `router.svelte.ts`: `HashRouter` e le rotte `#/regole`, `#/iscrizione`, `#/azioni`,
  `#/partecipanti`, `#/admin` (routing via hash, vedi ADR 0001).
- `../App.svelte`: macchina a stati dell'app, `booting` → `offline` | `anonymous` |
  `playing` | `administering`, secondo il ruolo della sessione. Da anonimo mostra regole e
  iscrizione; in gioco mostra tab bar e schermate; da admin il pannello. Se il backend non
  riconosce più la sessione (`unauthorized`, serata azzerata) dimentica il token e torna
  alle regole.

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (hash dell'URL).
