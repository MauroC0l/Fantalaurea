# app

Il guscio dell'applicazione: sceglie le implementazioni, gestisce la navigazione e il ciclo
di vita della sessione.

## Contenuto
- `compose.ts`: `composeApp()` è il composition root, l'unico punto che conosce le classi
  concrete di `infrastructure/`. Legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`, crea un solo
  client Supabase condiviso da `SupabaseBackend`, `SupabaseChat`, `SupabasePolls` (ADR 0019) e
  `SupabaseChallenges` (ADR 0020); questi ultimi due ricevono lo stesso `ChangeSignals` del
  backend, così c'è un solo canale `fantalaurea` per telefono. Collega il registratore dei
  vocali (`browserVoiceRecorder`, con il limite `VOICE_MAX_MS`) e fissa la qualità delle foto.
- `router.svelte.ts`: `PathRouter` (ADR 0017), che trasforma il percorso in un `Route`
  (definito in `features/routes.ts`, sotto `BASE_PATH`): `regole`, `parola`, `iscrizione`,
  `bacheca`, `azioni`, `classifica`, `profilo`, `giocatore/<id>`, `chat`,
  `conversazione/<id>`, `sondaggi`, `admin`, `utenti`, `album`, `serata`.
  - Usa la History API e intercetta i clic sui link interni (niente ricarica della pagina).
  - `go(route, { replace })`: `replace` si usa per i reindirizzamenti, così "indietro" non
    torna a una pagina che reindirizza di nuovo.
  - `back(fallback)`: torna indietro solo se la pagina precedente è dell'app.
  - Una pagina nuova si apre dall'alto; "indietro" ritrova il punto di scorrimento salvato
    nello stato della cronologia.
  - I vecchi link `#/…` vengono convertiti all'avvio.
- `../App.svelte`: macchina a stati `booting` → `offline` | `anonymous` (con la parola già
  data, `''` per l'admin, o nessuna) | `playing` | `administering`. Crea gli stati di partita,
  bacheca, lista delle chat, sondaggi (`PollsState`), profilo, conversazione aperta e la cache
  dei link foto, mostra la
  tab bar giusta per il ruolo (con il badge dei non letti sulla Chat, nascosta dentro una
  conversazione) e la conferma di uscita. Nasconde le schede delle funzioni spente
  dall'admin e, se la rotta corrente è una di quelle, porta alla prima scheda ancora accesa
  (il Profilo c'è sempre; `SCREEN_FEATURES` dice da quale funzione dipende ogni schermata, ADR
  0014: `sondaggi` → `polls`). Le schede del giocatore sono Bacheca / Azioni / Classifica /
  Chat / Sondaggi / Profilo; il pulsante "Nuovo" dei sondaggi dipende da
  `game.permissions.polls` (ADR 0018).
  Sfide a tempo (ADR 0020): `playing` e `administering` tengono anche `challenges`
  (`ChallengesState`), avviato all'ingresso e fermato con il resto, perché l'avviso deve
  arrivare su qualsiasi schermata. Per il giocatore `announceChallenge` mostra un avviso con
  vibrazione quando compare una sfida nuova (solo a chi ha l'app aperta: niente push);
  l'admin non riceve avvisi. Con la funzione accesa la scheda Azioni ha come badge
  `challenges.todo`. Con la funzione accesa `ActionsScreen` riceve `timed` (ADR 0021): i numeri
  di `ChallengesState` (`todo`, `mine.length`, il totale delle sfide) e due snippet costruiti
  qui con `ChallengesSection`, `timedBoard` (vista `board`, "Nuova" dipende da
  `game.permissions.challenges`) per il filtro "A tempo" e `timedDone` (vista `mine`) per
  "Fatte". In `AdminActionsScreen` la `ChallengesSection` entra come snippet `top`, con
  `canCreate`, solo se le sfide sono accese. "Invia
  messaggio" dal profilo apre (o crea) la conversazione e ci naviga. La conversazione riceve
  anche la lista delle chat (per l'inoltro) e gli appunti ("Copia testo"); la lista riceve la
  vibrazione (pressione lunga). Una sessione scaduta riporta alle regole con un avviso.
  `administering` tiene pannello, album, utenti (`UsersState`), sondaggi (`PollsState` con la
  sessione admin: crea e gestisce, non vota) e una propria cache dei link foto
  (`PhotoLinksCache`, per le foto profilo in Utenti e nei votanti); le schede admin sono Azioni /
  Utenti / Sondaggi / Album / Serata, e chi entra come admin su una rotta diversa da queste
  finisce su Azioni. Con 6 schede il giocatore vede solo le icone (`TabBar`, ADR 0019).

## Relazioni
- Dipende da: tutti gli altri moduli.
- Usato da: `main.ts`.
- Dati posseduti: la rotta corrente (percorso dell'URL) e il punto di scorrimento di ogni voce della cronologia.
