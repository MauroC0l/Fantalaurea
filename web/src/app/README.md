# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`, crea un solo
  client Supabase condiviso da `SupabaseBackend` e `SupabaseChat`, collega il registratore dei
  vocali (`browserVoiceRecorder`, con il limite `VOICE_MAX_MS`) e fissa la qualità delle foto.
- `router.svelte.ts`: `HashRouter`, che trasforma l'URL in un `Route` (definito in
  `features/routes.ts`): `#/regole`, `#/parola`, `#/iscrizione`, `#/bacheca`, `#/azioni`,
  `#/classifica`, `#/profilo`, `#/giocatore/<id>`, `#/chat`, `#/conversazione/<id>`,
  `#/admin`, `#/album`, `#/serata`. A ogni cambio di rotta torna in cima alla pagina: un solo
  documento ospita tutte le schermate, e senza questo una schermata nuova si aprirebbe al punto
  in cui era scorsa la precedente.
- `../App.svelte`: macchina a stati `booting` → `offline` | `anonymous` (con la parola già
  data, `''` per l'admin, o nessuna) | `playing` | `administering`. Crea gli stati di partita,
  bacheca, lista delle chat, profilo, conversazione aperta e la cache dei link foto, mostra la
  tab bar giusta per il ruolo (con il badge dei non letti sulla Chat, nascosta dentro una
  conversazione) e la conferma di uscita. Nasconde le schede delle funzioni spente
  dall'admin e, se la rotta corrente è una di quelle, porta alla prima scheda ancora accesa
  (il Profilo c'è sempre; `SCREEN_FEATURES` dice da quale funzione dipende ogni schermata, ADR 0014). "Invia
  messaggio" dal profilo apre (o crea) la conversazione e ci naviga. La conversazione riceve
  anche la lista delle chat (per l'inoltro) e gli appunti ("Copia testo"); la lista riceve la
  vibrazione (pressione lunga). Una sessione scaduta riporta alle regole con un avviso.

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (hash dell'URL).
