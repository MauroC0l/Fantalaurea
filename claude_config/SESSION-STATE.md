# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-25

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente (a fine serata si azzera tutto). È un gioco a punti con azioni da completare,
più un piccolo social interno: bacheca con post, like e profili. Si entra con una parola
segreta. Si usa quasi solo da telefono. Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`. Commit e push autorizzati liberamente.
- 0001 Svelte + TS SPA con routing via hash · 0002 Supabase · 0003 identità nickname + nome
  vero · 0004 livelli e porte.
- 0005 / 0006: admin `Administrator` / `admin`, credenziali pubbliche nel repo, confermato due
  volte dall'utente (l'ultima il 2026-09-25). Contromisura: log degli accessi admin.
- 0007 ogni azione una volta sola, annullabile · 0008 foto in bucket privato + Edge Function,
  JPEG 2560 px · 0009 niente backend in memoria · 0010 punti visibili, classifica a punti,
  difficoltà soft/medium/hard.
- 0011 serata chiusa:
  - parola segreta generata (e rigenerata a ogni "Termina e ricomincia"), modificabile
    dall'admin, che sceglie se far uscire chi è dentro;
  - nessuna tabella leggibile dai client; tempo reale solo come segnale "tabella X cambiata"
    sul canale broadcast `fantalaurea`;
  - "Sei tu?" quando un nuovo nickname ha un nome vero già presente: il vecchio profilo
    prende il nuovo nickname.
- 0012 bacheca stile Instagram (post con foto + didascalia di 300 caratteri, schede delle
  azioni completate, like con elenco), profili (foto quadrata, bio di 500 caratteri), foto
  visibili a tutti i partecipanti. Tab: Bacheca · Azioni · Classifica · Profilo. Admin:
  Azioni · Album · Serata.
- Azione "foto ai genitali" ELIMINATA (decisione dell'utente il 2026-09-25, dopo la
  segnalazione del rischio art. 612-ter).
- Titoli e difficoltà delle azioni proposti da Claude: l'utente li rivede dal pannello.

## Stato attuale (verificato 2026-09-25)
- Tutto implementato in locale e verificato:
  - 30 test unitari e 14 d'integrazione (`npm run test:db`);
  - prova nel browser con 3 telefoni simulati + admin: parola sbagliata e giusta, post, doppio
    tocco, elenco dei like, scheda in tempo reale, bio e foto profilo, profilo dalla
    classifica, passaggio del profilo, log admin, cambio parola con espulsione.
- In produzione dal 2026-09-25 (commit c5e5d62 e successivi). Scoperto in produzione che i
  broadcast generati dal database non arrivano ai canali pubblici del Supabase ospitato:
  ora i segnali partono dai client (ADR 0013, migrazione `20260925150000_client_change_signals.sql`).

## Prossimi passi
- L'utente prova con telefoni veri entro il 2026-09-30 (fotocamera, like, condivisione della
  parola, iPhone e Android) e rivede titoli e difficoltà.
- Dal 2026-09-30 solo correzioni.
- Prima di ogni festa: Supabase non in pausa; l'admin legge la parola nella scheda Serata e la
  condivide.

## Trappole
- Vite: `.env.production` vince su `.env.local`: il file locale è `web/.env.development.local`;
  per una build di prova sul locale usare `npx vite build --mode development`.
- La CLI Supabase non riesegue un seed già applicato: i dati per la produzione vanno in una
  migrazione.
- Supabase blocca `UPDATE` / `DELETE` senza `WHERE` (usare `where true`).
- Una funzione `stable` chiamata nella stessa istruzione di un `insert` non vede la riga
  nuova: separare le istruzioni (vedi `join_game`).
- Nei nuovi SQL attenzione agli alias chiamati `id`: la vista `all_completions` ha una colonna
  `id`.
- Le letture con token scaduto rispondono HTTP 403 (codice `28000`): è il segnale atteso.
- Cancellare righe dalla dashboard lascia file orfani nel bucket `photos`.
- Docker serve solo per sviluppare. Niente Python né `gh` su questa macchina; PowerShell blocca
  `npx` (usare `npx.cmd` o `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- Negli script bash evitare backtick e apostrofi dentro stringhe `node -e`: usare lo strumento
  di scrittura file.
